/* eslint-disable @typescript-eslint/no-unused-vars */
// TODO: clean imports after finish
import { entersState, getVoiceConnection, joinVoiceChannel, VoiceConnectionState, VoiceConnection, VoiceConnectionStatus } from "@discordjs/voice";
import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { cleanUpProcess } from "../utility/cleanup.js";
import { recordings } from "../utility/recordings.js";
import { setGuildState, getGuildState } from "../utility/last-channel-interaction.js";
// import { sendMessage } from "../utility/messages.js";

const data = new SlashCommandBuilder().setName("join").setDescription(
  "Allows the bot to join the same channel as the user.",
);

async function handleConnectionStateChange(
  oldState: VoiceConnectionState, 
  newState: VoiceConnectionState,
  connection: VoiceConnection,
  interaction: ChatInputCommandInteraction
) {
  // the issue with listening for "disconnected" states is that sometimes discord moves
  // the bot to one of their other servers, resulting in a "disconnected" state but 
  // is actually rerouting the connection to a different place.

  // instead of destroying the connection for every single time the discord servers migrate us,
  // we keep trying until it is measured impossible to join the voice channel due to lack of
  // permissions (never, the bot always has administrator privileges) or the bot's connection
  // is destroyed intentionally. if it is destroyed unintentionally (i.e. critical crash), then we
  // should treat it as if it was destroyed intentionally.
  console.log("VC state: ", oldState.status, "=>", newState.status);

  // if the voice connection was disconnected "weirdly", try reconnecting again
  // if the voice connection was "kicked" then the attempt to reconnect should fail
  if (newState.status === VoiceConnectionStatus.Disconnected) {
    try {
      await entersState(connection, VoiceConnectionStatus.Connecting, 5_000);
      return;
    } catch {
      connection.destroy();
    }
  }

  if (newState.status === VoiceConnectionStatus.Destroyed) {
    const guildId = interaction.guildId!
    const state = getGuildState(guildId);

    const textChannelId = state?.lastTextChannelId ?? interaction.channelId;
    const voiceChannelId = state?.lastVoiceChannelId ?? (interaction.member as GuildMember).voice.channel?.id;
    const client = state?.client ?? interaction.client;

    await cleanUpProcess(guildId, textChannelId, voiceChannelId!, client);
  }
}


async function execute(interaction: ChatInputCommandInteraction) {
  // if user tries to use the command in a DM (how)
  if (!interaction.inCachedGuild()) {
    await interaction.reply("Use this bot in discord servers only!");
    return;
  }

  const voiceObj = interaction.member.voice;
  const guildId = interaction.guildId;

  // if user is not in a voice channel
  if (!voiceObj.channel) {
    await interaction.reply("Join a voice channel and try again!");
    return;
  }

  // if there is a different recording going on in the same server
  if (recordings.get(guildId)?.length) {
    return interaction.reply("Recording in progress in another voice channel! You are not able to use /join at this time.");
  }

  // if a previous connection exists BUT there is nothing being recorded,
  // remove the connection and connect to the new voice channel
  const prevConn = getVoiceConnection(guildId);
  if (prevConn) {
    console.log(`Destroying ${voiceObj.channelId}`);
    prevConn.destroy();
  }

  const conn = joinVoiceChannel({
    adapterCreator: interaction.guild.voiceAdapterCreator,
    channelId: voiceObj.channel.id,
    guildId: guildId,
    selfDeaf: false,
    selfMute: true,
  });

  // set guild states, last channels interacted with
  setGuildState(interaction.guildId, {
    lastVoiceChannelId: voiceObj.channel.id,
    lastTextChannelId: interaction.channelId,
    client: interaction.client
  });

  // LISTEN FOR DISCONNECTED/DESTROYED CONNECTIONS
  conn.on("stateChange", async (oldState, newState) => {
    handleConnectionStateChange(oldState, newState, conn, interaction);
  });

  console.log(`joined ${voiceObj.channel.name}, id: ${voiceObj.channelId}`);
  await interaction.reply(`Joined ${voiceObj.channel.name}`);
}

export { data, execute };
