/* eslint-disable @typescript-eslint/no-unused-vars */
import { SlashCommandBuilder, GuildMember, ChatInputCommandInteraction, VoiceBasedChannel, ConnectionService, Client } from "discord.js";
import { getVoiceConnection, joinVoiceChannel } from '@discordjs/voice'

const data = new SlashCommandBuilder()
  .setName('record')
  .setDescription('Records voices in a voice channel.')

async function execute(interaction: ChatInputCommandInteraction) {
  // if (!interaction.inCachedGuild()) {
  //   await interaction.reply('Use this bot in discord servers only!')
  //   return
  // }
  // const member = await interaction.guild.members.fetch(interaction.user.id)
  // const channel = member.voice.channel as VoiceBasedChannel
  // if (!channel) {
  //   await interaction.reply('Use this command when you are in a voice channel!')
  //   return
  // }
  
  // const exConnection = getVoiceConnection(channel.guild.id)
  // console.log('Existing connection:', exConnection?.joinConfig.channelId)
  // console.log('Target channel:', channel.id)
  // exConnection?.destroy()

  // console.log('Creating new connection to:', channel.name)
  // const connection = joinVoiceChannel({
  //   debug: true,
  //   adapterCreator: channel.guild.voiceAdapterCreator,
  //   channelId: channel.id,
  //   guildId: channel.guild.id,
  //   selfDeaf: false
  // })
  // await interaction.reply(`Connected to ${channel.name}!`)

}

export { data, execute }