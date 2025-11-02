import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export const data = new SlashCommandBuilder().setName('ping').setDescription('Replies with pong!')

export async function execute (interaction: ChatInputCommandInteraction) {
  await interaction.reply('Pong!')
}

// module.exports = {
// 	data: new SlashCommandBuilder().setName('ping').setDescription('Replies with pong!'),
// 	async execute(interaction: ChatInputCommandInteraction) {
// 		await interaction.reply('Pong!');
// 	},
// };