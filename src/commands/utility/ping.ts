import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

const data = new SlashCommandBuilder().setName('ping').setDescription('Replies with pong!')

async function execute (interaction: ChatInputCommandInteraction) {
  await interaction.reply('Pong!')
}

export { data, execute }
