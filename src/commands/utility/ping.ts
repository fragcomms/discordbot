// test command
import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { buildEmbed } from "./messages.js";

const data = new SlashCommandBuilder().setName("ping").setDescription("Replies with pong!");

async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.reply({
    embeds: [buildEmbed("Pong!", 0x3399FF)],
  });
}

export { data, execute };
