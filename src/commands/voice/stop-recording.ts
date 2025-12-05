/* eslint-disable @typescript-eslint/no-unused-vars */
import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { cleanUpProcess } from "../utility/cleanup.js";
import { recordings } from '../utility/recordings.js';

const data = new SlashCommandBuilder()
  .setName('stop-recording')
  .setDescription('Stops a recording in progress.');

async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.inCachedGuild()) {
    await interaction.reply('This is a server-only command.')
    return
  }

  const guildId = interaction.guildId!;
  const guildRecordings = recordings.get(guildId);

  //TODO: check if user is in a channel that is currently recording
  if (!interaction.member.voice.channel) {
    await interaction.reply('Join the specific voice channel to stop recording!')
    return;
  }
  const channelId = interaction.channelId;
  const client = interaction.client;



  if (!guildRecordings || guildRecordings.length == 0) {
    await interaction.reply('Not currently recording.');
    return;
  }

  await interaction.reply('Stopping recording, processing files...');

  //STOP AND PROCESS ALL ACTIVE RECORDINGS
  cleanUpProcess(guildId, channelId, interaction.guild.members.me!.voice.channel!.id, client);
 }

export { data, execute };






//  IDEAL LAYOUT

/* 

IF stream in progress for channel: 
        STOP stream(s)
        FINALIZE & CONVERT audio files.
        NOTIFY channel that recording has stopped and files are saved.
ELSE:
        NOTIFY user(s) that no recording is in progress.

NOTES: might need some sort of time limit in /record in case user forgets to stop recording.


issue with /join making the bot leave before the recording stops.
    

*/