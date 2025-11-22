import { Client, TextChannel} from 'discord.js'
import { lastChannelInteraction } from './last-channel-interaction.js';


//SEND MESSAGE
export async function sendMessage(client: Client, channelId: string, msg: string) {
  const channel = await client.channels.fetch(channelId);
    if(!channel || !channel?.isTextBased()) {
      console.log(`Error using sendMessage:`);
      console.log(`Channel not text-based/channel not found`);
      return;
    }
    const textChannel = channel as TextChannel;
    await textChannel.send(msg);
}


// TODO: SEND EMBEDDED MESSAGE