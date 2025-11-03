/* eslint-disable @typescript-eslint/no-unused-vars */
import { ChatInputCommandInteraction, SlashCommandBuilder, GuildMember, GatewayIntentBits, Client, InteractionCallback } from "discord.js";
import { joinVoiceChannel, getVoiceConnection } from '@discordjs/voice'

const data = new SlashCommandBuilder().setName('join').setDescription('Allows the bot to join the same channel as the user.');

async function execute(interaction: ChatInputCommandInteraction) {
  const member = interaction.member as GuildMember;
  const channel = member.voice?.channel;

  if (!channel) { 
    await interaction.reply('Use this command when you are in a voice channel!')
    return
   }

  const alreadyConnected = getVoiceConnection(channel.guild.id);
  if (alreadyConnected) {
    alreadyConnected.destroy();
  }

  joinVoiceChannel({
    adapterCreator: channel.guild.voiceAdapterCreator,
    channelId: channel.id,
    guildId: channel.guild.id,
    selfDeaf: false
  });

  console.log(`joined ${channel.name}, id: ${channel.id}`);

}

export { data, execute }