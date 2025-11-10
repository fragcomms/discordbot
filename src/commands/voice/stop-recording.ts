/* eslint-disable @typescript-eslint/no-unused-vars */
import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import fs from "fs";
import { exec } from "child_process";
import { recordings, Recording } from '../utility/recordings.js';
import { convertMultiplePcmToMka, convertPcmToWav } from '../utility/audio-conversion.js';
import ffmpeg from 'ffmpeg-static'
import path from "path";

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
  }

  if (!guildRecordings || guildRecordings.length == 0) {
    await interaction.reply('Not currently recording.');
    return;
  }

  await interaction.reply('Stopping recording, processing files...');

  //STOP AND PROCESS ALL ACTIVE RECORDINGS
  for (const recording of guildRecordings) {       // iterate through all active recordings
    try {
      recording.opusStream.destroy();     // stop the stream
      const wavPath = await convertPcmToWav(recording.user, recording.filePath); // convert file, get path string
      await interaction.followUp({
        content: `Finished processing recording session in ${interaction.member.voice.channel?.name}. \nSaved as .wav file`,
        files: [wavPath]
      }
      )
    }
    catch (error) {
      console.error(error)
      await interaction.followUp(`Could not stop recording for ${recording.user.username}:`);
    }
  }
  const wavPath = await convertMultiplePcmToMka(path.join(process.cwd(), 'data', guildId), guildRecordings[0].timestamp)
  await interaction.followUp({
    content: `Compiled all user's recordings to one.`,
    files: [wavPath]
  })

  recordings.delete(guildId) // delete once finished, we don't need to keep old streams
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