import { Client, Events, Guild, InteractionCallback, VoiceState } from "discord.js";
import {  cleanUpProcess } from "../commands/utility/cleanup.js";
import { getGuildState, setGuildState } from "../commands/utility/last-channel-interaction.js";
import { sendMessage } from "../commands/utility/messages.js";
import {Recording, recordings} from "../commands/utility/recordings.js"
import { getVoiceConnection} from "@discordjs/voice";

const name = Events.VoiceStateUpdate;
async function execute(oldState: VoiceState, newState: VoiceState, client: Client) {

  

  // get guild id
  const guild = oldState.guild;
  const guildId = guild.id;
  
  // get guild recordings by guildId
  const guildRecordings = recordings.get(guildId);
  
  
  // find last interactions by guildId
  const state = getGuildState(guildId)

  // get necessary values for cleanup process from GuildState Map
  const textChannelId = state?.lastTextChannelId;
  const voiceChannelId = state?.lastVoiceChannelId;
  const sessionClient = state?.client;

  if (oldState.channel && !newState.channel || oldState.channel && newState.channel) { // handle disconnects & vc switches


    const vcMembers = oldState.channel.members.filter(member => !member.user.bot); // all human members in vc
    const theBot = oldState.channel.members.filter(member => member.user.bot) // the bot's status in the vc
    const theBotIsAlone = (vcMembers.size > 0 && theBot.size === 1);
    const connection = getVoiceConnection(guildId);

    if (!oldState.channel) return; 
    if (!oldState.channel.members) return; 
    if (oldState.member?.id === sessionClient!.user?.id) {
      connection?.destroy();
      return;
    }

    

    if(theBotIsAlone) {
      connection?.destroy();
    }

    if (guildRecordings && guildRecordings.length > 0 && (vcMembers.size === 0 || theBot.size === 0)) { // if recording in progress, but either the bot leaves or everybody but the bot leaves
      // console.log(`CHANNEL ID = ${channelId}`);
      cleanUpProcess(         // wrap it up
        guildId!, 
        textChannelId!,
        voiceChannelId!, 
        sessionClient!
      );
      connection?.destroy();
      
    }

  } 


}

export { execute, name };
