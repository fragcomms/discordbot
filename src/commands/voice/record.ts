/* eslint-disable @typescript-eslint/no-unused-vars */
import { SlashCommandBuilder, ChatInputCommandInteraction, User } from 'discord.js';
import { EndBehaviorType, getVoiceConnection, VoiceReceiver, VoiceConnection } from '@discordjs/voice'
import { recordings, Recording, logRecordings } from '../utility/recordings.js';
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as prism from 'prism-media'
import { fileURLToPath } from 'node:url'
import ffmpeg from 'ffmpeg-static'

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

// Track RTP sequence numbers per SSRC (Synchronization Source)
const lastRtpSeqPerSSRC = new Map<number, number>();
// Track statistics per SSRC
const statsPerSSRC = new Map<number, { 
  totalPackets: number; 
  lostPackets: number;
  username: string;
}>();

// Inspect raw RTP packet from UDP socket
function inspectRTPPacket(buffer: Buffer, ssrc: number, username: string): { seq: number; loss: number } {
  if (buffer.length < 12) {
    return { seq: 0, loss: 0 };
  }

  const seq = buffer.readUInt16BE(2);

  // Initialize stats if first packet from this SSRC
  if (!statsPerSSRC.has(ssrc)) {
    statsPerSSRC.set(ssrc, { totalPackets: 0, lostPackets: 0, username });
    lastRtpSeqPerSSRC.set(ssrc, seq);
    return { seq, loss: 0 };
  }

  const stats = statsPerSSRC.get(ssrc)!;
  stats.totalPackets++;

  let loss = 0;
  const prevSeq = lastRtpSeqPerSSRC.get(ssrc)!;

  // Check for packet loss by comparing sequence numbers
  const expected = (prevSeq + 1) & 0xFFFF;
  
  if (seq !== expected) {
    // Calculate packets lost (accounting for wraparound)
    loss = (seq - expected) & 0xFFFF;
    
    if (loss > 0 && loss < 100) {
      stats.lostPackets += loss;
      console.warn(
        `⚠️  [${username}] RTP packet loss detected! Expected seq: ${expected}, Got: ${seq}, Lost: ${loss} packets`
      );
    }
  }

  lastRtpSeqPerSSRC.set(ssrc, seq);

  return { seq, loss };
}

// Inspect the internal voice connection structure
function debugVoiceConnection(voiceConnection: VoiceConnection) {
  const internal = (voiceConnection as any);
  
  console.log('\n🔍 Debugging Voice Connection Structure:');
  console.log('Available properties:', Object.keys(internal).filter(k => !k.startsWith('_')));
  
  if (internal.state) {
    console.log('State:', Object.keys(internal.state));
  }
  
  if (internal.receiver) {
    console.log('Receiver available:', true);
    const recInternal = (internal.receiver as any);
    console.log('Receiver properties:', Object.keys(recInternal).filter(k => !k.startsWith('_')));
  }
  
  if (internal.subscription) {
    console.log('Subscription available:', true);
  }
}

// Hook into receiver's packet handler - alternative approach
function setupRawPacketMonitoring(receiver: VoiceReceiver, voiceConnection: VoiceConnection, guildId: string) {
  try {
    // Debug the structure first
    debugVoiceConnection(voiceConnection);

    const internalReceiver = (receiver as any);
    const internalVoiceConn = (voiceConnection as any);
    
    // Try to find and hook into the udp socket's message handler
    // Check various possible locations where UDP socket might be stored
    const possibleSocketLocations = [
      () => internalVoiceConn.state?.subscription?.connection?.udp?.socket,
      () => internalVoiceConn.state?.connection?.udp?.socket,
      () => internalVoiceConn.state?.udp?.socket,
      () => internalReceiver.udp?.socket,
      () => internalVoiceConn.udp?.socket,
    ];

    let socket = null;
    for (const getSocket of possibleSocketLocations) {
      try {
        socket = getSocket();
        if (socket) {
          console.log('✅ Found UDP socket!');
          break;
        }
      } catch (e) {
        // continue
      }
    }

    if (socket && socket.on) {
      const originalHandler = socket.listeners('message').length > 0 
        ? socket.listeners('message')[0] 
        : null;

      socket.removeAllListeners('message');
      
      socket.on('message', (buffer: Buffer, rinfo: any) => {
        // Call original handler if exists
        if (originalHandler) {
          originalHandler(buffer, rinfo);
        }

        // Process for packet loss detection
        if (buffer.length >= 12) {
          const ssrc = buffer.readUInt32BE(8);
          let username = `User(${ssrc})`;
          
          if (internalReceiver.ssrcMap) {
            for (const [userId, info] of internalReceiver.ssrcMap) {
              if (info.ssrc === ssrc) {
                username = info.userId || userId;
                break;
              }
            }
          }
          
          inspectRTPPacket(buffer, ssrc, username);
        }
      });

      console.log(`✅ Raw packet monitoring enabled (via UDP socket hook) for guild ${guildId}`);
      return;
    }

    console.warn('⚠️  Could not find UDP socket for packet monitoring');
    console.log('📋 Using timing-based loss detection instead');
  } catch (error) {
    console.warn(`⚠️  Error setting up raw packet monitoring: ${error}`);
    console.log('📋 Using timing-based loss detection instead');
  }
}

// Get statistics for an SSRC
function getSSRCStats(ssrc: number) {
  return statsPerSSRC.get(ssrc);
}

//REQUIRED: FFmpeg installed on machine!!!!!!!!
async function createListeningStream(
  receiver: VoiceReceiver,
  user: User,
  guildId: string,
  channelId: string,
  datenow: string,
  voiceConnection: VoiceConnection
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
  let estimatedLostFrames = 0;
  
  console.log(`[${user.username}] 🎙️  Started recording`);
  console.log(`[${user.username}] 💾 Saving to: ${filePath}`);
  
  // Handle each incoming packet from Discord
  opusStream.on('data', (chunk: Buffer) => {
    const now = Date.now();
    totalFrames++;

    // Handle silence gaps and estimate packet loss
    if (lastFrameTime > 0) {
      const delta = now - lastFrameTime;
      
      if (delta > 40) {
        const estimatedMissing = Math.floor(delta / 20) - 1;
        if (estimatedMissing > 0 && estimatedMissing < 50) {
          estimatedLostFrames += estimatedMissing;
          totalGapMs += delta - 20;
          const silence = Buffer.alloc(estimatedMissing * 960 * 2 * 2, 0);
          outputStream.write(silence);
        }
      }
    }

    // Log statistics every 500 frames (~10 seconds of speech)
    if (totalFrames % 500 === 0) {
      const totalExpected = totalFrames + estimatedLostFrames;
      const successRate = totalExpected > 0 
        ? ((totalFrames / totalExpected) * 100).toFixed(2)
        : '100.00';
      
      console.log(
        `[${user.username}] 📊 Received: ${totalFrames} | ` +
        `Estimated lost: ${estimatedLostFrames} | Success: ${successRate}% | ` +
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
    console.error(`[${user.username}] ❌ Stream error:`, error);
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

  // Setup raw UDP packet monitoring
  setupRawPacketMonitoring(receiver, voiceConnection, interaction.guildId);

  // For each user, create a listening stream
  const datenow = Date.now()
  for (const user of users) {
    console.log(`Listening to ${user.username}`)
    createListeningStream(
      receiver,
      user,
      interaction.guildId,
      interaction.guild.members.me!.voice.channel!.id,
      datenow.toString(),
      voiceConnection
    );
  }
}

export { data, execute }