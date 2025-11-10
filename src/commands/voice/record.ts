/* eslint-disable @typescript-eslint/no-unused-vars */
// clean these imports after fully functional command
import { SlashCommandBuilder, ChatInputCommandInteraction, ButtonBuilder, ButtonStyle, User, MembershipScreeningFieldType, GuildMember, InteractionCallback, Guild, VoiceChannel } from 'discord.js';
import { EndBehaviorType, getVoiceConnection, VoiceReceiver } from '@discordjs/voice'
import { recordings, Recording, logRecordingsState } from '../utility/recordings.js';
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
async function createListeningStream(receiver: VoiceReceiver, user: User, guildId: string) {
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
  const dataDir = path.join(path.join(process.cwd(), 'data'), user.id)
  fs.mkdirSync(dataDir, { recursive: true })

  const filePath = path.join(dataDir, `${Date.now()}.pcm`)
  const outputStream = fs.createWriteStream(filePath)

  opusStream.pipe(decoder).pipe(outputStream)

  // store the recording object in the recordings map
  const rec: Recording = {
    opusStream,
    filePath,
    user,
  }

  if (!recordings.has(guildId)) {
    recordings.set(guildId, []);
  }

  recordings.get(guildId)!.push(rec);

  //log in console
  logRecordingsState();

  // end of stream
  // opusStream.on('end', () => {
  //   console.log(`Finished recording ${user.username} to ${filePath}`)

  //   const wavPath = filePath.replace(/\.pcm$/, '.wav')
  //   // grabs ffmpeg path and runs this
  //   const ffmpegProcess = spawn(ffmpegPath, [
  //     '-f', 's16le', '-ar', '48k', '-ac', '2', '-i', filePath, wavPath,
  //   ])

  //   // exports the output to console
  //   ffmpegProcess.stderr.on('data', (data) => {
  //     console.log(`[ffmpeg] ${data}`)
  //   })

  //   // once it's finished, see if theres an error
  //   ffmpegProcess.on('close', (code) => {
  //     if (code === 0) {
  //       console.log(`Success: ${wavPath}`)
  //       path.resolve()
  //     } else {
  //       console.error(`ffmpeg exited with code ${code}`)
  //       return
  //     }
  //   })
  // })
}

async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.inCachedGuild()) {
    await interaction.reply('Use this bot in discord servers only!')
    return
  }
  if (!interaction.guild.members.me?.voice.channel) {
    await interaction.reply('I am not in a voice channel!')
    return
  }
  // grab all users that were given in command
  const userOptionNames = Array.from({ length: 6 }, (_, i) => `user${i + 1}`)
  const users = userOptionNames
    .map(name => interaction.options.getUser(name))
    .filter((u): u is import('discord.js').User => u !== null)

  //TODO: add error checking to see if user is in the voice channel, otherwise output an error and skip the user
  await interaction.reply(`Recording users: \n${users.map(u => `<@${u.id}>`).join(',\n')}`)

  const receiver = getVoiceConnection(interaction.guildId)!.receiver

  // for each user, create a listening stream
  for (const user of users) {
    console.log(`Listening to ${user.username}`)
    createListeningStream(receiver, user, interaction.guildId!);
  }
}

export { data, execute }