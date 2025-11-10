import { Client, Collection, GatewayIntentBits } from 'discord.js';
import type { Command } from './Command.js'

// discordjs doesn't have "commands", typescript requires that
// this extendedclient exists purely because of "commands" - aaron
class ExtendedClient extends Client {
	commands: Collection<string, Command>
	constructor() {
		super({ intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates ] });
    this.commands = new Collection
	}
}

export { ExtendedClient }