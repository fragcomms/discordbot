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

// Track our own sequence numbers to detect if Discord.js drops packets
const sequencePerUser = new Map<string, number>();
// Track statistics per user
const statsPerUser = new Map<string, { totalPackets: number; expectedPackets: number }>();

// Track packets using timing-based loss detection
function trackPacket(userId: string, timestamp: number): { seq: number; estimatedLoss: number } {
  // Initialize stats if first packet from this user
  if (!statsPerUser.has(userId)) {
    statsPerUser.set(userId, { totalPackets: 0, expectedPackets: 0 });
    sequencePerUser.set(userId, 0);
  }

  const stats = statsPerUser.get(userId)!;
  const currentSeq = sequencePerUser.get(userId)!;
  
  stats.totalPackets++;
  sequencePerUser.set(userId, currentSeq + 1);

  // Discord sends packets every ~20ms when speaking
  // We can estimate loss by comparing timing gaps
  let estimatedLoss = 0;

  return { seq: currentSeq, estimatedLoss };
}

// Get statistics for a user
function getUserStats(userId: string) {
  return statsPerUser.get(userId);
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
  let estimatedLostFrames = 0;
  
  console.log(`[${user.username}] 🎙️  Started monitoring incoming packets from Discord`);
  console.log(`[${user.username}] 💾 Saving to: ${filePath}`);
  console.log(`[${user.username}] ⚠️  Note: Discord.js strips RTP headers - using timing-based loss detection`);
  
  // Handle each incoming packet from Discord
  opusStream.on('data', (chunk: Buffer) => {
    const now = Date.now();
    totalFrames++;

    // Track this packet (can't read RTP headers since Discord.js strips them)
    const { seq } = trackPacket(user.id, now);

    // Handle silence gaps (when user stops speaking and resumes)
    // Also use this to estimate packet loss
    if (lastFrameTime > 0) {
      const delta = now - lastFrameTime;
      
      // If gap is significantly larger than 20ms, we might have lost packets
      if (delta > 40) {
        const estimatedMissing = Math.floor(delta / 20) - 1;
        if (estimatedMissing > 0) {
          estimatedLostFrames += estimatedMissing;
          totalGapMs += delta - 20;
          
          // Only warn if it's not a huge gap (huge gaps = silence, not loss)
          if (estimatedMissing < 50) {
            console.warn(
              `⚠️  [${user.username}] Possible packet loss! Gap: ${delta}ms, ` +
              `Estimated missing frames: ${estimatedMissing}`
            );
          }
          
          // Create silence buffer and write to output
          const silence = Buffer.alloc(estimatedMissing * 960 * 2 * 2, 0);
          outputStream.write(silence);
        }
      }
    }

    // Log statistics every 500 frames (~10 seconds of speech)
    if (totalFrames % 500 === 0) {
      const stats = getUserStats(user.id);
      if (stats) {
        const totalExpected = stats.totalPackets + estimatedLostFrames;
        const successRate = totalExpected > 0
          ? (stats.totalPackets / totalExpected) * 100
          : 100;
        
        console.log(
          `[${user.username}] 📊 Stats - Received: ${stats.totalPackets} | ` +
          `Estimated lost: ${estimatedLostFrames} | Success: ${successRate.toFixed(2)}% | ` +
          `Total gaps: ${totalGapMs}ms`
        );
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

  const receiver = getVoiceConnection(interaction.guildId)!.receiver

  // For each user, create a listening stream
  const datenow = Date.now()// required to make all recordings have same UNIX time
  for (const user of users) {
    console.log(`Listening to ${user.username}`)
    createListeningStream(
      receiver,
      user,
      interaction.guildId,
      interaction.guild.members.me.voice.channel.id,
      datenow.toString()
    );
  }
}

export { data, execute }