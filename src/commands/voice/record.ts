/* eslint-disable @typescript-eslint/no-unused-vars */
import { SlashCommandBuilder, ChatInputCommandInteraction, User } from 'discord.js';
import { EndBehaviorType, getVoiceConnection, VoiceReceiver, VoiceConnection, VoiceConnectionStatus, entersState } from '@discordjs/voice'
import { recordings, Recording, logRecordings, monitors } from '../utility/recordings.js';
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

function getLocalUdpPort(connection: VoiceConnection): number | null {
  // Check if the connection is Ready 
  const state = connection.state as any;
  if (state.status !== VoiceConnectionStatus.Ready) {
    return null;
  }

  // Access the networking object
  const networking = state.networking || state._networking;
  if (!networking) return null;

  // Access the private _state inside networking
  const internalState = networking.state || networking._state;

  // Debug log
  if (internalState) {
    console.log('Internal State Keys:', Object.keys(internalState));
  } else {
    console.warn('Could not find internal networking state');
  }

  // find UDP object inside internal state
  const udp = networking.udp || networking._udp || internalState?.udp || internalState?._udp;

  if (!udp) {
    console.warn('UDP object not found in networking or internal state');
    return null;
  }

  const socket = udp.socket || udp._socket;
  if (!socket) return null;

  try {
    return socket.address().port;
  } catch (e) {
    return null;
  }
}

async function startPyshark(connection: VoiceConnection, guildId: string, users: User[]): Promise<ChildProcess | null> {
  try {
    if (connection.state.status !== VoiceConnectionStatus.Ready) {
      console.log('Connection not ready yet, waiting for Ready state...');
      try {
        await entersState(connection, VoiceConnectionStatus.Ready, 5000);
      } catch (error) {
        console.error('Connection failed to become Ready within 5s');
        return null;
      }
    }

    const localPort = getLocalUdpPort(connection);
    if (!localPort) {
      console.warn('Could not find UDP socket information.');
      return null;
    }

    console.log(`UDP Socket found: ${localPort}`);

    const pythonPath = path.resolve(process.cwd(), 'src', 'commands', 'voice', 'networking', '.venv', 'bin', 'python');
    const scriptPath = path.resolve(process.cwd(), 'src', 'commands', 'voice', 'networking', 'monitor.py');

    // Check if files exist before spawning
    if (!fs.existsSync(pythonPath)) console.error(`Python not found at: ${pythonPath}`);
    if (!fs.existsSync(scriptPath)) console.error(`Monitor script not found at: ${scriptPath}`);

    const pysharkProcess = spawn(pythonPath, [scriptPath, localPort.toString()], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // --- UPDATED STDOUT HANDLER ---
    pysharkProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const json = JSON.parse(line);

          // Handle startup message (doesn't have 'type', uses 'status')
          if (json.status === 'started') {
            console.log(`[Monitor] ${json.msg} (Port: ${json.port})`);
            continue;
          }

          // Handle standard message types
          switch (json.type) {
            case 'stats':
              console.log(`[Stats] [SSRC: ${json.ssrc}] Seq: ${json.seq} | Jitter: ${json.current_jitter_ms}ms (Avg: ${json.avg_jitter_ms}ms) | Pkts: ${json.packets}`);
              break;

            case 'loss':
              console.log(`[LOSS] [SSRC: ${json.ssrc}] ${json.msg} (Lost: ${json.lost}) Severity: ${json.severity}`);
              break;

            case 'alert':
              // Use console.warn for alerts
              console.warn(`[ALERT] [SSRC: ${json.ssrc}] ${json.msg} | Avg: ${json.avg_jitter_ms}ms | Max: ${json.max_jitter_ms}ms | ${json.suggestion}`);
              break;

            case 'debug':
              // Only print debug if you really want to see silence gaps
              console.log(`[Debug] [SSRC: ${json.ssrc}] ${json.msg} (Gap: ${json.gap_ms}ms)`);
              break;

            case 'info':
              console.log(`[Info] [SSRC: ${json.ssrc}] ${json.msg} | Avg Jitter: ${json.avg_jitter_ms}ms`);
              break;
            
            case 'error':
              console.error(`[Monitor Error] ${json.msg}`);
              break;

            case 'final_stats':
              console.log(`[Final] [SSRC: ${json.ssrc}] Total: ${json.total_packets} | Final Avg: ${json.avg_jitter_ms}ms | Events: ${json.high_jitter_events} High / ${json.critical_jitter_events} Crit`);
              break;

            case 'shutdown':
               console.log(`[Monitor] ${json.msg}`);
               break;

            default:
              // Fallback for unknown messages
              if (json.ssrc) {
                console.log(`[Unknown Type] [SSRC: ${json.ssrc}] ${JSON.stringify(json)}`);
              } else {
                console.log(`[System] ${JSON.stringify(json)}`);
              }
          }

        } catch (e) {
          // If a line isn't JSON, just print it raw
          console.log(`[Raw Output] ${line}`);
        }
      }
    });
    // ------------------------------

    pysharkProcess.stderr.on('data', (data) => {
      console.error(`[Pyshark Stderr]: ${data}`);
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

  console.log(`[${user.username}] Started recording`);
  console.log(`[${user.username}] Saving to: ${filePath}`);

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

  const pythonMonitor = await startPyshark(voiceConnection, interaction.guildId!, users);

  if (pythonMonitor) {
    monitors.set(interaction.guildId!, pythonMonitor);
  }

  voiceConnection.on('stateChange', (oldState, newState) => {
    if (newState.status === VoiceConnectionStatus.Destroyed || newState.status === VoiceConnectionStatus.Disconnected) {
      const monitor = monitors.get(interaction.guildId!);
      if (monitor && !monitor.killed) {
        console.log('Connection died, killing Pyshark monitor...');
        monitor.kill();
        monitors.delete(interaction.guildId!);
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