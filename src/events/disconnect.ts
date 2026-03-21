import { Client, Events, Guild, InteractionCallback, VoiceState } from "discord.js";
import {  cleanUpProcess } from "../commands/utility/cleanup.js";
import { getGuildState, setGuildState } from "../commands/utility/last-channel-interaction.js";

const name = Events.VoiceStateUpdate;
async function execute(oldState: VoiceState, newState: VoiceState, client: Client) {
  if (oldState.channel && !newState.channel) { //

    const guild = oldState.guild;
    const guildId = guild.id;
    
    const state = getGuildState(guildId)

    const textChannelId = state?.lastTextChannelId;
    const voiceChannelId = state?.lastVoiceChannelId;
    const client = state?.client;

    // console.log(`CHANNEL ID = ${channelId}`);
    cleanUpProcess(
      guildId!, 
      textChannelId!,
      voiceChannelId!, 
      client!);
    // cleanUpDirectory("data");
  }
}

export { execute, name };
