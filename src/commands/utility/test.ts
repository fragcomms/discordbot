import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

const data = new SlashCommandBuilder().setName('test').setDescription('response: it works!')

async function execute (interaction: ChatInputCommandInteraction) {
    await interaction.reply('it works!');
    return;
};

export {data, execute};


