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

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Ready! Logged in as ${readyClient.user.tag}`)
  const guild = await client.guilds.fetch(process.env.GUILD_ID!)
  console.log(`Found ${guild}`)
  const channel = client.channels.cache.get(process.env.CHANNEL_ID!)
  if (channel instanceof TextChannel) {
    console.log(`Found ${channel.name}`)
    await channel.send(`Hello, bot is started. Time is ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} UTC`)
  }
})

client.login(process.env.DISCORD_TOKEN)

// client.commands = new Collection()

// const foldersPath = path.join(__dirname, 'commands')
// const commandFolders = fs.readdirSync(foldersPath)

// for (const folder of commandFolders) {
// 	const commandsPath = path.join(foldersPath, folder)
// 	const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'))
// 	for (const file of commandFiles) {
// 		const filePath = path.join(commandsPath, file)
// 		const command = require(filePath)
// 		if ('data' in command && 'execute' in command) {
// 			client.commands.set(command.data.name, command)
// 		}
// 		else {
// 			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`)
// 		}
// 	}
// }

// //events
// const eventsPath = path.join(__dirname, 'events')
// const eventFiles = fs.readdirSync(eventsPath).filter((file) => file.endsWith('.js'))
// for (const file of eventFiles) {
// 	const filePath = path.join(eventsPath, file)
// 	const event = require(filePath)
// 	if (event.once) {
// 		client.once(event.name, (...args) => event.execute(...args))
// 	} else {
// 		client.on(event.name, (...args) => event.execute(...args))
// 	}
// }

// // slash command
// client.on(Events.InteractionCreate, async (interaction) => {
// 	if (!interaction.isChatInputCommand()) return
// 	const command = (interaction.client as ExtendedClient).commands.get(interaction.commandName)
// 	if (!command) {
// 		console.error(`No command matching ${interaction.commandName} was found.`)
// 		return
// 	}
// 	try {
// 		await command.execute(interaction)
// 	} catch (error) {
// 		console.error(error)
// 		if (interaction.replied || interaction.deferred) {
// 			await interaction.followUp({
// 				content: 'There was an error while executing this command!',
// 				flags: MessageFlags.Ephemeral,
// 			})
// 		} else {
// 			await interaction.reply({
// 				content: 'There was an error while executing this command!',
// 				flags: MessageFlags.Ephemeral,
// 			})
// 		}
// 	}
// })

// // not slash command
// client.on(Events.InteractionCreate, (interaction) => {
// 	if (!interaction.isChatInputCommand()) return
// 	console.log(interaction)
// })

// client.on(Events.InteractionCreate, async (interaction) => {
//   if (!interaction.isCh)
// })