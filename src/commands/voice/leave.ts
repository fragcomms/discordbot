/* eslint-disable @typescript-eslint/no-unused-vars */
import { getVoiceConnection } from "@discordjs/voice";
import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder, VoiceBasedChannel } from "discord.js";
// import { cleanUpDirectory } from "../utility/cleanup.js";
import { setFlagsFromString } from "v8";
import { logger } from "../../utils/logger.js";
import { buildEmbed } from "../utility/messages.js";

const data = new SlashCommandBuilder()
  .setName("leave")
  .setDescription("Disconnects the bot from the current voice channel.");

async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.inCachedGuild()) {
    await interaction.reply({
      embeds: [buildEmbed("Use this bot in discord servers only!", 0xFF0000)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const channel = member.voice.channel as VoiceBasedChannel;

  const connection = getVoiceConnection(channel.guild.id);
  if (!connection) {
    await interaction.reply({
      embeds: [buildEmbed("I am not in a voice channel!", 0xFF0000)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  connection.destroy();
  logger.info(`Destroying ${channel.id}`);
  await interaction.reply({
    embeds: [buildEmbed(`Successfully disconnected from ${channel.name}.`, 0x3399FF)],
  });
}

export { data, execute };
