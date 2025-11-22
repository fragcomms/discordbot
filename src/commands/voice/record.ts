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

//REQUIRED: FFmpeg installed on machine!!!!!!!!
async function createListeningStream(receiver: VoiceReceiver, user: User, guildId: string, channelId: string, datenow: string) {
  // creates a listener on the user, raw packets atm
  const opusStream = receiver.subscribe(user.id, {
    end: {
      //TODO: add a manual stop record because inactivity is individual, not the whole group
      behavior: EndBehaviorType.Manual
    },
  })
  // converts raw packets to have the format of an audio file
  const decoder = new prism.opus.Decoder({
    rate: 48000,
    channels: 2, // unsure if 1 or 2
    frameSize: 960,
  })

  // root directory
  // this can be replaced by a database insertion once its finished
  const dataDir = path.join(process.cwd(), 'data', guildId, channelId, user.id)
  fs.mkdirSync(dataDir, { recursive: true })

  const filePath = path.join(dataDir, `${datenow}.pcm`)
  const outputStream = fs.createWriteStream(filePath)

  // silence gap adder
  let lastPacketTime = Number(datenow)
  opusStream.on('data', () => {
    const now = Date.now()
    const delta = now - lastPacketTime

    // each frame is 20ms of audio at 48kHz
    const missingFrames = Math.floor(delta / 20) - 1
    if (missingFrames > 0) {
      // 960 * 2 bytes/sample * 2 channels
      const silence = Buffer.alloc(missingFrames * 960 * 2 * 2, 0)
      outputStream.write(silence)
    }
    lastPacketTime = now
  })

  opusStream.pipe(decoder).pipe(outputStream)

  // store the recording object in the recordings map
  const rec: Recording = {
    opusStream,
    filePath,
    user,
    timestamp: datenow,
  }

  if (!recordings.has(guildId)) {
    recordings.set(guildId, []);
  }
  
  recordings.get(guildId)!.push(rec);

  //log in console
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