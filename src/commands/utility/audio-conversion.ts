
import { exec } from 'child_process';
import { User } from 'discord.js';
import ffmpegPath from 'ffmpeg-static';


//exportable function pcm -> wav
export async function convertPcmToWav(user: User, filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {

    const wavPath = filePath.replace(/\.pcm$/, '.wav');
    const cmd = `"${ffmpegPath}" -f s16le -ar 48k -ac 2 -i "${filePath}" "${wavPath}"`;
    //const cmd = `"${ffmpegPath}" -f s16le -ar 48000 -ac 2 -i "${filePath}" "${wavPath}"`;

    exec(cmd, (error, stdout, stderr) => {

      if (error) {

        console.error(`FFmpeg failed for ${filePath}:`, stderr);
        reject(error);
        return;
      }

      console.log(`Converted ${user}'s audio file to ${wavPath}`);
      resolve(wavPath); // return the path of the wav file
    });
  });
}
