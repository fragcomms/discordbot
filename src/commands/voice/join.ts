/* eslint-disable @typescript-eslint/no-unused-vars */
import { ChatInputCommandInteraction, SlashCommandBuilder, GuildMember, GatewayIntentBits, Client, InteractionCallback, VoiceBasedChannel, IntegrationApplication } from "discord.js";
import { joinVoiceChannel, getVoiceConnection } from '@discordjs/voice'

const data = new SlashCommandBuilder().setName('join').setDescription('Allows the bot to join the same channel as the user.');

async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.inCachedGuild()) {
    await interaction.reply('Use this bot in discord servers only!')
    return
  }
  if (!interaction.member.voice.channel) {
    await interaction.reply('Join a voice channel and try again!')
    return
  }
  let connection = await getVoiceConnection(interaction.guildId)
  if (connection) {
    console.log(`Destroying ${interaction.member.voice.channelId}`)
    connection.destroy()
  }
  connection = await joinVoiceChannel({
    adapterCreator: interaction.guild.voiceAdapterCreator,
    channelId: interaction.member.voice.channel.id,
    guildId: interaction.guild.id,
    selfDeaf: false,
    selfMute: true
  });

  console.log(`joined ${interaction.member.voice.channel!.name}, id: ${interaction.member.voice.channelId}`);
  await interaction.reply(`Joined ${interaction.member.voice.channel!.name}`)
}

export { data, execute }