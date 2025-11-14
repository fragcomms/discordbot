/* eslint-disable @typescript-eslint/no-unused-vars */
import { ChatInputCommandInteraction, SlashCommandBuilder, VoiceBasedChannel } from "discord.js";
import { getVoiceConnection } from '@discordjs/voice'


const data = new SlashCommandBuilder()
  .setName('leave')
  .setDescription('Disconnects the bot from the current voice channel.');

async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.inCachedGuild()) {
    await interaction.reply('Use this bot in discord servers only!')
    return
  }
  const member = await interaction.guild.members.fetch(interaction.user.id)
  const channel = member.voice.channel as VoiceBasedChannel

  const connection = getVoiceConnection(channel.guild.id)
  if (!connection) {
    await interaction.reply('I am not in a voice channel!')
    return
  }

  //TODO: stop recording after told to leave
  //DONE: stop recording after told to leave handled in /join

  connection.destroy()
  console.log(`Destroying ${channel.id}`)
  await interaction.reply(`Successfully disconnected from ${channel.name}.`)
}

export { data, execute }