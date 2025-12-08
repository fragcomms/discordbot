/* eslint-disable @typescript-eslint/no-unused-vars */
import { SlashCommandBuilder, ChatInputCommandInteraction, User } from 'discord.js';
import { EndBehaviorType, getVoiceConnection, VoiceReceiver, VoiceConnection } from '@discordjs/voice'
import { recordings, Recording, logRecordings } from '../utility/recordings.js';
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as prism from 'prism-media'
import { fileURLToPath } from 'node:url'
import ffmpeg from 'ffmpeg-static'
import { spawn, ChildProcess } from 'node:child_process' // Import spawn

const ffmpegPath = ffmpeg as unknown as string
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const data = new SlashCommandBuilder()
  .setName('record')
  .setDescription('Records voices in a voice channel.')
  .addUserOption((option) => option
    .setName('user1')
    .setDescription('User to be recorded')
    .setRequired(true))
  .addUserOption((option) => option
    .setName('user2')
    .setDescription('User to be recorded'))
  .addUserOption((option) => option
    .setName('user3')
    .setDescription('User to be recorded'))
  .addUserOption((option) => option
    .setName('user4')
    .setDescription('User to be recorded'))
  .addUserOption((option) => option
    .setName('user5')
    .setDescription('User to be recorded'))
  .addUserOption((option) => option
    .setName('user6')
    .setDescription('User to be recorded'))

// Track statistics per SSRC
const statsPerSSRC = new Map<number, { 
  totalPackets: number; 
  lostPackets: number;
  username: string;
}>();

// Get statistics for an SSRC
function getSSRCStats(ssrc: number) {
  return statsPerSSRC.get(ssrc);
}

function startPyshark(connection: VoiceConnection, guildId: string): ChildProcess | null {
  try {
    // ⚠️ ACCESSING INTERNAL: discord.js doesn't publicly expose the UDP socket
    // We need the local port so Pyshark knows which traffic is ours.
    const networkState = (connection.state as any).networking;
    const udpSocket = networkState?.udp?.socket;
    
    if (!udpSocket) {
      console.warn('❌ Could not find UDP socket information. Pyshark will not start.');
      return null;
    }

    // Get the port the bot is listening on locally
    const localPort = udpSocket.address().port;
    console.log(`🔎 Spawning Pyshark monitor for UDP Port: ${localPort}`);

    // Spawn Python process
    // Ensure 'monitor.py' is in the correct directory relative to where you run the bot
    const pysharkProcess = spawn('./networking/.venv/bin/python', ['monitor.py', localPort.toString()], {
      stdio: ['ignore', 'pipe', 'pipe'] 
    });

    pysharkProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
            const json = JSON.parse(line);
            if (json.type === 'loss') {
                console.warn(`⚠️ [Pyshark] Packet Loss Detected (SSRC: ${json.ssrc}): ${json.lost} packets`);
            } else if (json.type === 'stats') {
               // Optional: excessively verbose
               // console.log(`📊 [Pyshark] Stats (SSRC: ${json.ssrc}): Total ${json.total} | Loss ${json.total_loss}`);
            } else {
                console.log(`🐍 [Pyshark] ${JSON.stringify(json)}`);
            }
        } catch (e) { 
            // Plain text output
            console.log(`🐍 [Pyshark] ${line}`);
        }
      }
    });

    pysharkProcess.stderr.on('data', (data) => {
      console.error(`[Pyshark Error]: ${data}`);
    });

    return pysharkProcess;

  } catch (error) {
    console.error('Failed to start Pyshark monitor:', error);
    return null;
  }
}

//REQUIRED: FFmpeg installed on machine!!!!!!!!
async function createListeningStream(
  receiver: VoiceReceiver,
  user: User,
  guildId: string,
  channelId: string,
  datenow: string
) {
  // Subscribe to the user's audio stream
  const opusStream = receiver.subscribe(user.id, {
    end: { behavior: EndBehaviorType.Manual },
  });

  // Decode opus audio to PCM format
  const decoder = new prism.opus.Decoder({
    rate: 48000,
    channels: 2,
    frameSize: 960,
  });

  // Create directory for this user's recording
  const dataDir = path.join(process.cwd(), 'data', guildId, channelId, user.id);
  fs.mkdirSync(dataDir, { recursive: true });

  const filePath = path.join(dataDir, `${datenow}.pcm`);
  const outputStream = fs.createWriteStream(filePath);

  // Initialize tracking variables
  let totalFrames = 0;
  let lastFrameTime = 0;
  let totalGapMs = 0;
  
  console.log(`[${user.username}] 🎙️  Started recording`);
  console.log(`[${user.username}] 💾 Saving to: ${filePath}`);
  
  // Handle each incoming packet from Discord
  opusStream.on('data', (chunk: Buffer) => {
    const now = Date.now();
    totalFrames++;

    // Handle silence gaps
    if (lastFrameTime > 0) {
      const delta = now - lastFrameTime;
      
      if (delta > 40) {
        const estimatedMissing = Math.floor(delta / 20) - 1;
        if (estimatedMissing > 0 && estimatedMissing < 50) {
          totalGapMs += delta - 20;
          const silence = Buffer.alloc(estimatedMissing * 960 * 2 * 2, 0);
          outputStream.write(silence);
        }
      }
    }

    // Log statistics every 500 frames (~10 seconds of speech)
    if (totalFrames % 500 === 0) {
      console.log(
        `[${user.username}] Audio frames received: ${totalFrames} | ` +
        `Silence gaps: ${totalGapMs}ms`
      );
      
      // Also print RTP-level stats if available
      const ssrcInfo = (receiver as any).ssrcMap?.get(user.id);
      if (ssrcInfo) {
        const rtpStats = getSSRCStats(ssrcInfo.ssrc);
        if (rtpStats && rtpStats.totalPackets > 0) {
          const rtpSuccessRate = ((rtpStats.totalPackets - rtpStats.lostPackets) / rtpStats.totalPackets * 100).toFixed(2);
          console.log(
            `[${user.username}] 📡 RTP-level: Received ${rtpStats.totalPackets} | ` +
            `Lost: ${rtpStats.lostPackets} | Success: ${rtpSuccessRate}%`
          );
        }
      }
    }
    
    lastFrameTime = now;
  });

  // Handle stream errors
  opusStream.on('error', (error) => {
    console.error(`[${user.username}] Stream error:`, error);
  });

  // Pipe opus stream through decoder to output file
  opusStream.pipe(decoder).pipe(outputStream);

  // Create recording object and store it
  const rec: Recording = {
    opusStream,
    filePath,
    user,
    timestamp: datenow,
  };

  if (!recordings.has(guildId)) {
    recordings.set(guildId, []);
  }
  recordings.get(guildId)!.push(rec);
  logRecordings();
}

async function execute(interaction: ChatInputCommandInteraction) {
  //check if interaction is in guild
  if (!interaction.inCachedGuild()) {
    await interaction.reply('Use this bot in discord servers only!')
    return
  }
  //check if bot is in voice channel
  if (!interaction.guild.members.me?.voice.channel) {
    await interaction.reply('I am not in a voice channel!')
    return
  }
  //check if user is in voice channel
  if (!interaction.member.voice.channel) {
    await interaction.reply('You are not in a voice channel!')
    return
  }
  //check if user is in same voice channel as bot
  if (interaction.member.voice.channel.id !== interaction.guild.members.me.voice.channel.id) {
    await interaction.reply('You must be in the same voice channel as me to use this command!')
    return
  }
  //check if recording already in progress in this guild
  const guildRecordings = recordings.get(interaction.guildId!); //for this guild
  if (guildRecordings && guildRecordings.length > 0) {        // if recordings in progress
    await interaction.reply('Recording already in progress.\nPlease stop current recording before starting another one.')
    return
  }
  
  // Grab all users that were given in command
  const userOptionNames = Array.from({ length: 6 }, (_, i) => `user${i + 1}`)
  const users = userOptionNames
    .map(name => interaction.options.getUser(name))
    .filter((u): u is User => u !== null)

  await interaction.reply(`Recording users: \n${users.map(u => `<@${u.id}>`).join(',\n')}`)

  const voiceConnection = getVoiceConnection(interaction.guildId)!;
  const receiver = voiceConnection.receiver;

  const pythonMonitor = startPyshark(voiceConnection, interaction.guildId!);

  voiceConnection.on('stateChange', (oldState, newState) => {
      if (newState.status === 'destroyed' || newState.status === 'disconnected') {
          if (pythonMonitor && !pythonMonitor.killed) {
              console.log('Killing Pyshark monitor...');
              pythonMonitor.kill();
          }
      }
  });

  // For each user, create a listening stream
  const datenow = Date.now()
  for (const user of users) {
    console.log(`Listening to ${user.username}`)
    createListeningStream(
      receiver,
      user,
      interaction.guildId,
      interaction.guild.members.me!.voice.channel!.id,
      datenow.toString()
    );
  }
}

export { data, execute }