/* eslint-disable @typescript-eslint/no-unused-vars */
// clean these imports after fully functional command
import { SlashCommandBuilder, ChatInputCommandInteraction, ButtonBuilder, ButtonStyle, User, MembershipScreeningFieldType, GuildMember, InteractionCallback, Guild, VoiceChannel } from 'discord.js';
import { EndBehaviorType, getVoiceConnection, VoiceReceiver } from '@discordjs/voice'
import { recordings, Recording, logRecordings } from '../utility/recordings.js';
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as prism from 'prism-media'
import { fileURLToPath } from 'node:url'
import { spawn, exec } from 'child_process'
import ffmpeg from 'ffmpeg-static'
import { OpusStream } from 'prism-media/typings/opus.js';
import { Channel, channel } from 'node:diagnostics_channel';
import { UDPIntegrityMonitor } from '../../monitor/upd_integrity_monitor.js';

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

const udpMonitors = new Map<string, UDPIntegrityMonitor>();

//REQUIRED: FFmpeg installed on machine!!!!!!!!
async function createListeningStream(receiver: VoiceReceiver, user: User, guildId: string, channelId: string, datenow: string) {
  const opusStream = receiver.subscribe(user.id, {
    end: { behavior: EndBehaviorType.Manual },
  });
  const decoder = new prism.opus.Decoder({
    rate: 48000,
    channels: 2,
    frameSize: 960,
  });

  const dataDir = path.join(process.cwd(), 'data', guildId, channelId, user.id);
  fs.mkdirSync(dataDir, { recursive: true });

  const filePath = path.join(dataDir, `${datenow}.pcm`);
  const outputStream = fs.createWriteStream(filePath);

  let lastPacketTime = Number(datenow);
  let totalPackets = 0;
  let lostPackets = 0;
  let totalGapMs = 0;
  
  opusStream.on('data', (chunk: Buffer) => {
    const now = Date.now();
    const delta = now - lastPacketTime;
    totalPackets++;

    // Discord sends packets every 20ms
    // If gap > 40ms, we likely lost packets
    if (delta > 40 && lastPacketTime !== Number(datenow)) {
      const estimatedLost = Math.floor(delta / 20) - 1;
      lostPackets += estimatedLost;
      totalGapMs += delta - 20;
      console.warn(`[${user.username}] ⚠️  Packet loss detected! Gap: ${delta}ms, Estimated lost: ${estimatedLost}`);
    }

    // Insert silence for missing frames
    const missingFrames = Math.floor(delta / 20) - 1;
    if (missingFrames > 0) {
      const silence = Buffer.alloc(missingFrames * 960 * 2 * 2, 0);
      outputStream.write(silence);
    }

    // Log stats every 500 packets
    if (totalPackets % 500 === 0) {
      const successRate = ((totalPackets - lostPackets) / (totalPackets + lostPackets)) * 100;
      console.log(`[${user.username}] 📊 Stats - Received: ${totalPackets} | Lost: ${lostPackets} | Success: ${successRate.toFixed(2)}% | Total gap: ${totalGapMs}ms`);
    }
    
    lastPacketTime = now;
  });

  opusStream.pipe(decoder).pipe(outputStream);

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
  
  //TODO: add error checking if user has already started a recording in the channel
  // grab all users that were given in command
  const userOptionNames = Array.from({ length: 6 }, (_, i) => `user${i + 1}`)
  const users = userOptionNames
    .map(name => interaction.options.getUser(name))
    .filter((u): u is import('discord.js').User => u !== null)

  //TODO: add error checking to see if user is in the voice channel, otherwise output an error and skip the user
  await interaction.reply(`Recording users: \n${users.map(u => `<@${u.id}>`).join(',\n')}`)

  const receiver = getVoiceConnection(interaction.guildId)!.receiver

  // for each user, create a listening stream
  const datenow = Date.now()// required to make all recordings have same UNIX time
  for (const user of users) {
    console.log(`Listening to ${user.username}`)
    createListeningStream(receiver, user, interaction.guildId, interaction.guild.members.me.voice.channel.id, datenow.toString());
  }
}

export { data, execute }
