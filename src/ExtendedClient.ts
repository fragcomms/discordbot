import { Client, Collection, GatewayIntentBits } from 'discord.js';
import type { Command } from './types/Command.ts'

export class ExtendedClient extends Client {
	public commands: Collection<string, Command>

	constructor() {
		super({ intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent ] });
    this.commands = new Collection
	}
}