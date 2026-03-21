/* eslint-disable @typescript-eslint/no-unused-vars */
// TODO: clean imports after finish
import { getVoiceConnection, joinVoiceChannel, VoiceConnectionStatus } from "@discordjs/voice";
import { ChatInputCommandInteraction, Client, InteractionCallback, SlashCommandBuilder } from "discord.js";
import { cleanUpProcess } from "../utility/cleanup.js";
import { recordings } from "../utility/recordings.js";
import { setGuildState, getGuildState } from "../utility/last-channel-interaction.js";
// import { sendMessage } from "../utility/messages.js";

const data = new SlashCommandBuilder().setName("join").setDescription(
  "Allows the bot to join the same channel as the user.",
);

async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.inCachedGuild()) {
    await interaction.reply("Use this bot in discord servers only!");
    return;
  }
  if (!interaction.member.voice.channel) {
    await interaction.reply("Join a voice channel and try again!");
    return;
  }

  // DON'T STOP ANOTHER RECORDING WITH /JOIN
  const guildRecordings = recordings.get(interaction.guildId);
  if (guildRecordings && guildRecordings.length > 0) {
    await interaction.reply(
      `Recording in progress in another voice channel! You are not able to use /join at this time.`,
    );
    return;
  }

  let connection = getVoiceConnection(interaction.guildId);
  if (connection) {
    console.log(`Destroying ${interaction.member.voice.channelId}`);
    connection.destroy();
  }
  connection = joinVoiceChannel({
    adapterCreator: interaction.guild.voiceAdapterCreator,
    channelId: interaction.member.voice.channel.id,
    guildId: interaction.guild.id,
    selfDeaf: false,
    selfMute: true,
  });

  // set guild states, last channels interacted with
  setGuildState(interaction.guildId, {
    lastVoiceChannelId: interaction.member.voice.channel.id,
    lastTextChannelId: interaction.channelId,
    client: interaction.client

  });

  // LISTEN FOR DISCONNECTS
  connection.on("stateChange", async (oldState, newState) => {
    if (
      newState.status === VoiceConnectionStatus.Disconnected
      || newState.status === VoiceConnectionStatus.Destroyed
    ) {
      console.log(
        `Disconnect logged from voice channel in guild ${interaction.guildId}`,
      );

      // guild states, variables
      const state = getGuildState(interaction.guildId);

      // variables for cleanup process, taken from GuildState or interaction
      const textChannelId = state?.lastTextChannelId ?? interaction.channelId;
      const voiceChannelId = state?.lastVoiceChannelId ?? interaction.member.voice.channel?.id;
      const client = state?.client ?? interaction.client;
      
    

      try {
       
      
        // disconnect when bot is disconnected by any means
        await cleanUpProcess (
          interaction.guildId!,
          textChannelId!, 
          voiceChannelId!,  // last refactor changed the number of arguments,
          client!,          // so cleanupProcess didn't execute i guess 
        );
      } catch(e) {
        console.error("Error during cleanup process:", e);
      }
    }
  });

  console.log(`joined ${interaction.member.voice.channel.name}, id: ${interaction.member.voice.channelId}`);
  await interaction.reply(`Joined ${interaction.member.voice.channel.name}`);
}

export { data, execute };
