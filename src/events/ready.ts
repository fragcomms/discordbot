import { generateDependencyReport } from "@discordjs/voice";
import { Client, Events, TextChannel } from "discord.js";
import { logger } from "../utils/logger.js"
import { buildEmbed } from "../commands/utility/messages.js";

const name = Events.ClientReady;
const once = true;
async function execute(client: Client) {
  logger.info(`Ready! Logged in as ${client.user?.tag}`);
  logger.info(generateDependencyReport());
  const guild = await client.guilds.fetch(process.env.GUILD_ID!);
  logger.info(`Found ${guild.name}`);
  const channel = client.channels.cache.get(process.env.CHANNEL_ID!);
  if (channel instanceof TextChannel) {
    const now = new Date();
    const dateOptions: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "short",
      day: "numeric",
    };
    const timeOptions: Intl.DateTimeFormatOptions = {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    };
    const utcDate = now.toLocaleDateString("en-US", dateOptions);
    const utcTime = now.toLocaleTimeString("en-US", timeOptions);
    const localTimeZone = now.toLocaleString("en-US", {timeZoneName: "short"});
    logger.info(`Found ${channel.name}`);


    const readyMsg = `Hello! \n\nThe FragComms bot is now online. \nTimestamp: ${localTimeZone}`
    const embed = buildEmbed(readyMsg, 0x90EE90 );
    
    await channel.send({ embeds: [embed] });
  }
}

export { execute, name, once };
