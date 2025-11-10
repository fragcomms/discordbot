import { REST, Routes } from 'discord.js'
import 'dotenv/config'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Command } from './types/Command.js'

const commands: Command[] = []
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const foldersPath = path.join(__dirname, 'commands')
const commandFolders = fs.readdirSync(foldersPath)

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder)
  const commandFiles = fs.readdirSync(commandsPath).filter((file) => /\.(js|ts)$/.test(file))
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file)
    const command = await import(filePath)
    if ('data' in command && 'execute' in command) {
      commands.push(command.data.toJSON())
    } else {
      console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`)
    }
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

export async function refreshCommands() {
  if (process.env.NODE_ENV === 'development') {
    (async () => {
      try {
        console.log(`Started refreshing ${commands.length} application (/) commands LOCALLY.`)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const data = await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID!, process.env.GUILD_ID!), { body: commands })
      } catch (error) {
        console.error(error)
      }
    })()
  } else if (process.env.NODE_ENV === 'production') {
    (async () => {
      try {
        console.log(`Started refreshing ${commands.length} application (/) commands GLOBALLY.`)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const data = await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), { body: commands })
      } catch (error) {
        console.error(error)
      }
    })()
  } else if (process.env.NODE_ENV === 'reset'){
    (async () => {
      try {
        console.log(`Removing all GLOBAL commands.`)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const data = await rest.put(Routes.applicationCommands(process.env.CLIENT_ID!), { body: [] })
      } catch (error) {
        console.error(error)
      }
    })()
  } else {
    console.log("incorrect node environment, try again")
  }
}

refreshCommands()