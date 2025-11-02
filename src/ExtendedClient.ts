import { Client, Collection, CommandInteraction, GatewayIntentBits } from 'discord.js';

export class ExtendedClient extends Client {
	public commands: Collection<string, any> = new Collection();
	constructor() {
		super({ intents: [GatewayIntentBits.Guilds] });
	}
}