/* eslint-disable @typescript-eslint/no-unused-vars */
import { SlashCommandBuilder, GuildMember, ChatInputCommandInteraction, VoiceBasedChannel, ConnectionService, Client } from "discord.js";
import { getVoiceConnection } from '@discordjs/voice'

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

async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.inCachedGuild()) {
    await interaction.reply('Use this bot in discord servers only!')
    return
  }
  if (!interaction.member.voice.channel) {
    await interaction.reply('Join a voice channel and try again!')
    return
  }
  const userOptionNames = Array.from({ length: 6 }, (_, i) => `user${i + 1}`)
  const users = userOptionNames
    .map(name => interaction.options.getUser(name))
    .filter((u): u is import('discord.js').User => u !== null)

  console.log(`Recording users: ${users.map(u => u.username).join(', ')}`)
  await interaction.reply(`Recording users: \n${users.map(u => `<@${u.id}>`).join(',\n')}`)

  // await interaction.reply(`Recording ${user.username}'s voice`)
  // console.log(`Recording ${user.username}'s voice`)
}

export { data, execute }