/* eslint-disable @typescript-eslint/no-unused-vars */
import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { logger } from "../../utils/logger.js";
import { cleanUpProcess } from "../utility/cleanup.js";
import { buildEmbed } from "../utility/messages.js";
import { recordings } from "../utility/recordings.js";

const data = new SlashCommandBuilder()
  .setName("stop-recording")
  .setDescription("Stops a recording in progress.");

async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.inCachedGuild()) {
    await interaction.reply({
      embeds: [buildEmbed("This is a server-only command.", 0xFF0000)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const guildId = interaction.guildId!;
  const guildRecordings = recordings.get(guildId);

  // not in voice channel
  const botVoiceChannel = interaction.guild.members.me?.voice.channel;
  if (!botVoiceChannel) {
    await interaction.reply({
      embeds: [buildEmbed("I am not currently in a voice channel.", 0xFF0000)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // TODO: check if user is in a channel that is currently recording
  if (interaction.member.voice.channel?.id !== botVoiceChannel.id) {
    await interaction.reply({
      embeds: [buildEmbed("You must be in the same voice channel as the bot to stop the recording!", 0xFF0000)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  
  const channelId = interaction.channelId;
  const client = interaction.client;

  if (!guildRecordings || guildRecordings.length == 0) {
    await interaction.reply({
      embeds: [buildEmbed("Not currently recording.", 0xFF0000)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.reply({
    embeds: [buildEmbed("Stopping recording, processing files...", 0xFACC15)],
  }); //

  // STOP AND PROCESS ALL ACTIVE RECORDINGS
  try {
    await cleanUpProcess(guildId, channelId, botVoiceChannel.id, client);
  } catch (error) {
    logger.error(`Failed to execute cleanUpProcess for guild ${guildId}:`, error);
  }
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
