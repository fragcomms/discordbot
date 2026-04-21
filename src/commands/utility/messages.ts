import { Client, TextChannel, EmbedBuilder } from "discord.js";
import { lastChannelInteraction } from "./last-channel-interaction.js";
import { logger } from "../../utils/logger.js";
import { data } from "./user.js";

// SEND MESSAGE (not replies)
export async function sendMessage(client: Client, channelId: string, msg: string) {

  const channel = await client.channels.fetch(channelId);
    if (!channel || !channel?.isTextBased()) {
      logger.error(`Error using sendMessage:`);
      logger.error(`Channel not text-based/channel not found`);
      return;
    }

  const textChannel = channel as TextChannel;
  

  // TODO: pass argument that switches if statement to embed or regular
  // but idk if we really need regular messages at all...
  // will change the replies to ephemeral embeds soon(?)
  
  if (false) { 
    // send regular message
    textChannel.sendTyping();
    await textChannel.send({ 
      content: msg
    });
    return;
  }

  else {
    // embedded message

    //build embed
    const embed = new EmbedBuilder();
    embed.setURL("http://frags.ayayrom.cfd");
    embed.setTitle("FragComms"); // setAuthor instead?
    embed.setColor(0x3399FF); // a nice CT blue
    embed.setTimestamp(new Date());
    embed.setDescription(msg);
    embed.setFooter({ text: "FragComms Bot", iconURL: "https://i.imgur.com/Og115ol.jpeg" });

    // send embed
    textChannel.sendTyping();
    await textChannel.send({
       embeds: [embed], 
      });
    

  }
}

// build embeds for messages
export function buildEmbed(description: string, hexColor: number) {
  const embed = new EmbedBuilder();
  embed.setURL("http://frags.ayayrom.cfd");
  embed.setTitle("FragComms");
  embed.setColor(hexColor);
  embed.setTimestamp(new Date());
  embed.setDescription(description);
  embed.setFooter({ text: "FragComms Bot", iconURL: "https://i.imgur.com/Og115ol.jpeg" });
  return embed;
}

// 0x3399FF CT blue (same one from renderPalette, just converted to hex)
// 0xFACC15 T orange-yellow (from ReplayPage scoreboard, converted to hex)
// 0x90EE90 Light green (for success messages and such)
// 0xFF0000 Red (for error messages etc)

