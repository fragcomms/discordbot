/* eslint-disable @typescript-eslint/no-unused-vars */
import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from "discord.js";
import { cleanUpProcess } from "../utility/cleanup.js";
import { recordings } from "../utility/recordings.js";
import { logger } from "../../utils/logger.js"
import { buildEmbed } from "../utility/messages.js";

const data = new SlashCommandBuilder()
  .setName("stop-recording")
  .setDescription("Stops a recording in progress.");

async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.inCachedGuild()) {
    await interaction.reply({ 
      embeds: [buildEmbed("This is a server-only command.", 0xFF0000)],
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  const guildId = interaction.guildId!;
  const guildRecordings = recordings.get(guildId);

  // TODO: check if user is in a channel that is currently recording
  if (!interaction.member.voice.channel) {
    await interaction.reply({ 
      embeds: [buildEmbed("Join the specific voice channel to stop recording!", 0xFF0000)],
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  const channelId = interaction.channelId;
  const client = interaction.client;

  if (!guildRecordings || guildRecordings.length == 0) {
    await interaction.reply({ 
      embeds: [buildEmbed("Not currently recording.", 0xFF0000)],
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  await interaction.reply({ 
    embeds: [buildEmbed("Stopping recording, processing files...", 0xFACC15)] 
  }); //

  // STOP AND PROCESS ALL ACTIVE RECORDINGS
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
