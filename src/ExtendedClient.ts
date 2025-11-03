import { Client, Collection, GatewayIntentBits } from 'discord.js';
import type { Command } from './types/Command.ts'

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