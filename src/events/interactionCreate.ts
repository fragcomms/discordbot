/* eslint-disable @typescript-eslint/no-unused-vars */
import { ChatInputCommandInteraction, Events, MessageFlags } from "discord.js";
import { lastChannelInteraction } from "../commands/utility/last-channel-interaction.js";
import { ExtendedClient } from "../types/ExtendedClient.js";
import { buildEmbed } from "../commands/utility/messages.js";
import { logger } from "../utils/logger.js"

const name = Events.InteractionCreate;
async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.isChatInputCommand()) return;

  const command = (interaction.client as ExtendedClient).commands.get(interaction.commandName);
  if (!command) {
    console.error(`No command matching ${interaction.commandName} was found.`);
    return;
  }

  try {
    // logger.info(interaction)
    await command.execute(interaction);
    // store guild & channel in map
    const channelId = interaction.channelId;
    const guildId = interaction.guildId;
    lastChannelInteraction.set(guildId!, channelId); // store

    // log to track channel id for disconnects
    logger.info(`Command used.`);
    logger.info(`Guild - ${lastChannelInteraction.keys().next().value}`);
    logger.info(`Channel - ${lastChannelInteraction.get(guildId!)}`);
  } catch (error) {
    console.error(error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        embeds: [buildEmbed("There was an error while executing this command!", 0xFF0000)],
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.reply({
        embeds: [buildEmbed("There was an error while executing this command!", 0xFF0000)],
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

export { execute, name };
