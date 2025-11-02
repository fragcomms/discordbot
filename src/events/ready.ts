import { Events, Client, TextChannel } from 'discord.js'

const name = Events.ClientReady
const once = true
async function execute(client: Client) {
  console.log(`Ready! Logged in as ${client.user?.tag}`)
  const guild = await client.guilds.fetch(process.env.GUILD_ID!)
  console.log(`Found ${guild}`)
  const channel = client.channels.cache.get(process.env.CHANNEL_ID!)
  if (channel instanceof TextChannel) {
    console.log(`Found ${channel.name}`)
    await channel.send(`Hello, bot is started. Time is ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} UTC`)
  }
}

export { name, once, execute }