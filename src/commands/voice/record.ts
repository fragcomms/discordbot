/* eslint-disable @typescript-eslint/no-unused-vars */
import { SlashCommandBuilder, GuildMember, ChatInputCommandInteraction, VoiceBasedChannel, ConnectionService, Client } from "discord.js";
import { getVoiceConnection, joinVoiceChannel } from '@discordjs/voice'

const data = new SlashCommandBuilder()
  .setName('record')
  .setDescription('Records voices in a voice channel.')

async function execute(interaction: ChatInputCommandInteraction) {
  
}

export { data, execute }