import { Client, TextChannel } from "discord.js";
import { lastChannelInteraction } from "./last-channel-interaction.js";
import { logger } from "../../utils/logger.js";

// SEND MESSAGE
export async function sendMessage(client: Client, channelId: string, msg: string) {
  const channel = await client.channels.fetch(channelId);
  if (!channel || !channel?.isTextBased()) {
    logger.error(`Error using sendMessage:`);
    logger.error(`Channel not text-based/channel not found`);
    return;
  }
  const textChannel = channel as TextChannel;
  await textChannel.send(msg);
}

// TODO: SEND EMBEDDED MESSAGE
