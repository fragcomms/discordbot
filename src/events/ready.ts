import { generateDependencyReport } from "@discordjs/voice";
import { Client, Events, TextChannel } from "discord.js";

const name = Events.ClientReady;
const once = true;
async function execute(client: Client) {
  console.log(`Ready! Logged in as ${client.user?.tag}`);
  console.log(generateDependencyReport());
  const guild = await client.guilds.fetch(process.env.GUILD_ID!);
  console.log(`Found ${guild.name}`);
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
    console.log(`Found ${channel.name}`);
    await channel.send(`Hello, bot has started. Time is ${utcDate} ${utcTime} ${new Date().getTimezoneOffset()}`);
  }
}

export { execute, name, once };
