/* eslint-disable @typescript-eslint/no-unused-vars */
import 'dotenv/config'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { ChatInputCommandInteraction, Client, ClientUser, Collection, Events, GatewayIntentBits, MessageFlags, GuildChannelManager, TextChannel } from 'discord.js'
import { ExtendedClient } from './ExtendedClient.js'
import { fileURLToPath } from 'node:url'

const client = new ExtendedClient()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

client.commands = new Collection()

const foldersPath = path.join(__dirname, 'commands')
const commandFolders = fs.readdirSync(foldersPath)

// run for all folders to check if commands are correct
for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder)
  const commandFiles = fs.readdirSync(commandsPath).filter((file) => /\.(js|ts)$/.test(file))
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file)
    const command = await import(filePath)
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command)
    } else {
      console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`)
    }
  }
}

// events support
const eventsPath = path.join(__dirname, 'events')
const eventFiles = fs.readdirSync(eventsPath) // list of things inside 'events' directory
for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file)
  const event = await import(filePath)
  console.log(`Loading event: ${event.name} from ${file}`)
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args))
  } else {
    client.on(event.name, (...args) => event.execute(...args))
  }
}

client.login(process.env.DISCORD_TOKEN)