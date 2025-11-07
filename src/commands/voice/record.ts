/* eslint-disable @typescript-eslint/no-unused-vars */
// clean these imports after fully functional command
import { SlashCommandBuilder, ChatInputCommandInteraction, ButtonBuilder, ButtonStyle, User } from "discord.js";
import { pipeline } from 'node:stream/promises'
import { EndBehaviorType, getVoiceConnection, VoiceReceiver } from '@discordjs/voice'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as prism from 'prism-media'
import { fileURLToPath } from "node:url";
import { exec } from 'child_process'
import { ChildProcess } from "node:child_process";

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
async function createListeningStream(receiver: VoiceReceiver, user: User) {
  // creates a listener on the user, raw packets atm
  const opusStream = receiver.subscribe(user.id, {
    end: {
      //TODO: add a manual stop record because inactivity is individual, not the whole group
      behavior: EndBehaviorType.AfterInactivity,
      duration: 10000
    },
  })
  // converts raw packets to have the format of an audio file
  const decoder = new prism.opus.Decoder({
    rate: 48000,
    channels: 2, // unsure if 1 or 2
    frameSize: 960,
  })

  // root directory
  const dataDir = path.join(path.join(process.cwd(), 'data'), user.id)
  fs.mkdirSync(dataDir, { recursive: true })

  const filePath = path.join(dataDir, `${Date.now()}.pcm`)
  const outputStream = fs.createWriteStream(filePath)

  opusStream.pipe(decoder).pipe(outputStream)

  // end of stream
  opusStream.on('end', () => {
    console.log(`Finished recording ${user.username} to ${filePath}`)
    
    const wavPath = filePath.replace(/\.pcm$/, '.wav')
    // conversion of file to .wav
    //TODO: make ffmpeg not cut the NULL packets
    const cmd = `ffmpeg -f s16le -ar 48k -ac 2 -i "${filePath}" "${wavPath}"`
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`FFmpeg failed for ${user.username}: `, stderr)
        return
      }
      console.log(`Converted ${user.username}'s recording to .wav`)
    })
  })
}

async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.inCachedGuild()) {
    await interaction.reply('Use this bot in discord servers only!')
    return
  }
  if (!interaction.member.voice.channel) {
    await interaction.reply('Join a voice channel and try again!')
    return
  }
  // grab all users that were given in command
  const userOptionNames = Array.from({ length: 6 }, (_, i) => `user${i + 1}`)
  const users = userOptionNames
    .map(name => interaction.options.getUser(name))
    .filter((u): u is import('discord.js').User => u !== null)

  //TODO: add error checking to see if user is in the voice channel, otherwise output an error and skip the user
  console.log(`Recording users: ${users.map(u => u.username).join(', ')}`)
  await interaction.reply(`Recording users: \n${users.map(u => `<@${u.id}>`).join(',\n')}`)

  const receiver = getVoiceConnection(interaction.guildId)!.receiver

  for (const user of users) {
    console.log(`Listening to ${user.username}`)
    createListeningStream(receiver, user)
  }
}

export { data, execute }