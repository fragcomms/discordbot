//TODO: stop recording when bot is force disconnected, this should be done for everything
import { recordings } from "../commands/utility/recordings.js";
import { convertMultiplePcmToMka } from "../commands/utility/audio-conversion.js";
import path from "path";
import { Client, TextChannel } from "discord.js";




export async function sendMessage(client: Client, channelId: string, msg: string) {
    const channel = client.channels.cache.get(channelId);
    if(!channel || !channel?.isTextBased()) {
        console.log(`Channel not text-based/channel not found`);
        return;
    }

    const textChannel = channel as TextChannel;
    await textChannel.send(msg);

}


export async function cleanUpProcess(guildId : string, channelId: string, client: Client) {

    const guildRecordings = recordings.get(guildId);
    if (!guildRecordings || guildRecordings.length == 0) {
        console.log(`No recording in progress`);
        return;
    }

     //STOP AND PROCESS ALL ACTIVE RECORDINGS
  for (const recording of guildRecordings) {       // iterate through all active recordings
    try {
      recording.opusStream.destroy();     // stop the stream
    //   const wavPath = await convertPcmToWav(recording.user, recording.filePath); // convert file, get path string
    //   sendMessage(client, channelId, `Finished processing recording session in voice channel. \nSaved as .wav file: ${wavPath}`);
    //   await interaction.followUp({
    //     content: `Finished processing recording session in ${interaction.member.voice.channel?.name}. \nSaved as .wav file`,
    //     files: [wavPath]
    //   }
    //   )
    }
    catch (error) {
      console.error(error)
      await sendMessage(client, channelId, `Could not stop recording for ${recording.user.username}:`);
    }
  }
  const wavPath = await convertMultiplePcmToMka(path.join(process.cwd(), 'data', guildId), guildRecordings[0].timestamp)
  await sendMessage(client, channelId, `Compiled all user's recordings to one: ${wavPath}`);

  recordings.delete(guildId) // delete once finished, we don't need to keep old streams


}




/*

1. STOP RECORDING
2. FINALIZE AUDIO
3. SEND MESSAGE

*/


