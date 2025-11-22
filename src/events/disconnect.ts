import { Events, Client, VoiceState } from 'discord.js'
import { cleanUpDirectory, cleanUpProcess } from '../commands/utility/cleanup.js'
import { lastChannelInteraction } from '../commands/utility/last-channel-interaction.js';


const name = Events.VoiceStateUpdate;
async function execute(oldState: VoiceState, newState: VoiceState, client: Client) {
    if(oldState.channel && !newState.channel) {     //
        const guildId = oldState.guild.id;
        const channelId = lastChannelInteraction.get(guildId);
        // console.log(`CHANNEL ID = ${channelId}`);
        // cleanUpProcess(guildId, channelId!, client);
        // cleanUpDirectory("data");
        
    }

    
}

export {name, execute}