/* eslint-disable @typescript-eslint/no-unused-vars */
import { SlashCommandBuilder, ChatInputCommandInteraction, User } from 'discord.js';
import { EndBehaviorType, getVoiceConnection, VoiceReceiver } from '@discordjs/voice'
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

// Track last sequence number per user (SSRC) to detect packet loss
const lastSeqPerUser = new Map<string, number>();

// Function to inspect raw UDP packet for sequence numbers
function inspectPacket(buffer: Buffer, userId: string): { seq: number; timestamp: number; loss: number } {
  // RTP header format:
  // byte 2-3 = sequence number (16-bit big-endian)
  // byte 4-7 = timestamp (32-bit big-endian)
  
  const seq = buffer.readUInt16BE(2);
  const timestamp = buffer.readUInt32BE(4);

  let loss = 0;
  const prev = lastSeqPerUser.get(userId);

  // Check for packet loss by comparing sequence numbers
  if (prev !== undefined) {
    // Expected sequence is previous + 1, wrapping at 65535
    const expected = (prev + 1) & 0xFFFF;
    
    if (seq !== expected) {
      // Calculate packets lost (accounting for wraparound)
      loss = (seq - expected) & 0xFFFF;
      
      if (loss > 0 && loss < 100) {
        // Only report if reasonable loss amount (filters out huge gaps from silence)
        console.warn(
          `[${userId}] ⚠️  Packet loss! Expected seq: ${expected}, Got: ${seq}, Lost: ${loss}`
        );
      }
    }
  }

  // Store this sequence number for next comparison
  lastSeqPerUser.set(userId, seq);

  return { seq, timestamp, loss };
}

//REQUIRED: FFmpeg installed on machine!!!!!!!!
async function createListeningStream(receiver: VoiceReceiver, user: User, guildId: string, channelId: string, datenow: string) {
  // Subscribe to the user's audio stream with raw UDP packets
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

  // Initialize packet tracking variables
  let totalPackets = 0;
  let totalLoss = 0;
  let lastPacketTime = 0;
  let totalGapMs = 0;
  
  console.log(`[${user.username}] 🎙️  Started monitoring UDP packets...`);
  
  // Handle each incoming packet
  opusStream.on('data', (chunk: Buffer) => {
    const now = Date.now();
    totalPackets++;

    // Inspect the raw UDP packet for RTP sequence number and detect loss
    const { seq, timestamp, loss } = inspectPacket(chunk, user.id);
    
    // Accumulate total packet loss
    if (loss > 0 && loss < 100) {
      totalLoss += loss;
    }

    // Handle silence gaps (when user stops speaking and resumes)
    if (lastPacketTime > 0) {
      const delta = now - lastPacketTime;
      // If more than 40ms gap, insert silence frames
      const missingFrames = Math.floor(delta / 20) - 1;
      if (missingFrames > 0) {
        totalGapMs += delta - 20;
        // Create silence buffer and write to output
        const silence = Buffer.alloc(missingFrames * 960 * 2 * 2, 0);
        outputStream.write(silence);
      }
    }

    // Log statistics every 500 packets (~10 seconds of speech)
    if (totalPackets % 500 === 0) {
      // Calculate success rate: (received packets - lost packets) / received packets * 100
      const successRate = totalPackets > 0 
        ? ((totalPackets - totalLoss) / totalPackets) * 100 
        : 100;
      
      console.log(
        `[${user.username}] 📊 Stats - Received: ${totalPackets} | Lost: ${totalLoss} | ` +
        `Success: ${successRate.toFixed(2)}% | Silence gaps: ${totalGapMs}ms`
      );
    }
    
    lastPacketTime = now;
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

  const receiver = getVoiceConnection(interaction.guildId)!.receiver

  // For each user, create a listening stream
  const datenow = Date.now()// required to make all recordings have same UNIX time
  for (const user of users) {
    console.log(`Listening to ${user.username}`)
    createListeningStream(receiver, user, interaction.guildId, interaction.guild.members.me.voice.channel.id, datenow.toString());
  }
}

export { data, execute }