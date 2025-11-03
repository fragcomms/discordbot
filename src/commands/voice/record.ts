/* eslint-disable @typescript-eslint/no-unused-vars */
import { SlashCommandBuilder, GuildMember, ChatInputCommandInteraction, VoiceBasedChannel } from "discord.js";
import { joinVoiceChannel } from '@discordjs/voice'

const data = new SlashCommandBuilder().setName('record').setDescription('Records voices in a voice channel.')

async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.inCachedGuild()) {
    await interaction.reply('Use this bot in discord servers only!')
    return
  }
  const channel = interaction.member.voice.channel as VoiceBasedChannel
  if (!channel) {
    await interaction.reply('Use this command when you are in a voice channel!')
    return
  }

  const connection = joinVoiceChannel({
    debug: true,
    adapterCreator: channel.guild.voiceAdapterCreator,
    channelId: channel.id,
    guildId: channel.guild.id,
    selfDeaf: false
  })
}

export { data, execute }