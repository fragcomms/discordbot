import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import fs from "fs";
import { exec } from "child_process";
import { recordings, Recording } from "../../utils/recordings.js";
import { convertPcmToWav } from "../../utils/audio-conversion.js";
import ffmpeg from 'ffmpeg-static'

const data = new SlashCommandBuilder().setName('stop-recording').setDescription('Stops a recording in progress, cleans up and converts the audio files, and posts the .wav file(s)');


async function execute(interaction: ChatInputCommandInteraction) {
        if(!interaction.inCachedGuild()){
            await interaction.reply('This is a server-only command.')
            return
        }

        const guildId = interaction.guildId!;
        const guildRecordings = recordings.get(guildId);

        if(!guildRecordings || guildRecordings.length == 0) {
                await interaction.reply('Not currently recording.');
                return;
        }

        await interaction.reply('Stopping recording, processing files...');


        //STOP AND PROCESS ALL ACTIVE RECORDINGS

        for(const recording of guildRecordings) {       // iterate through all active recordings
                
                try {
                        recording.opusStream.destroy();     // stop the stream
                        const wavPath = await convertPcmToWav(recording.user, recording.filePath); // convert file, get path string
                        await interaction.followUp({
                                content: `✔️ Finished processing recording session in ${interaction.member.voice.channel?.name}. \nSaved as .wav file 👇`,
                                files: [wavPath]
                        }
                        )
                } 
                catch (error) {
                        console.error(error)
                        await interaction.followUp(`❌ Could not stop recording for ${recording.user.username}:`);
                }
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