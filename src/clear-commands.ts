// deploying commands too often caused duplicates, this clears all commands
// run this in terminal to clear all commands

// I accidentally duplicated all of the commands with deploy-commands, so this was the solution

// src/utils/clear-commands.ts

import 'dotenv/config'; // automatically loads variables from .env
import { REST, Routes } from 'discord.js';

// Load environment variables
const BOT_TOKEN = process.env.DISCORD_TOKEN!;
const CLIENT_ID = process.env.CLIENT_ID!;
const GUILD_ID = process.env.GUILD_ID!;

if (!BOT_TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('❌ Missing BOT_TOKEN, CLIENT_ID, or GUILD_ID in .env');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

(async () => {
  try {
    // Clear all guild commands by sending an empty array
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: [] }
    );

    console.log('✅ Successfully cleared all guild commands.');
  } catch (error) {
    console.error('❌ Failed to clear guild commands:', error);
  }
})();
