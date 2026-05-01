/* eslint-disable @typescript-eslint/no-unused-vars */
import { exec, spawn } from "child_process";
// import { dir } from "console";
// import { User } from "discord.js";
// import ffmpegPath from "ffmpeg-static";
import fs from "fs";
import path from "path";
import { logger } from "../../utils/logger.js";

// exportable function pcm -> wav
// export async function convertPcmToWav(user: User, filePath: string): Promise<string> {
//   return new Promise((resolve, reject) => {
//     const wavPath = filePath.replace(/\.pcm$/, ".wav");
//     const cmd = `"${ffmpegPath}" -f s16le -ar 48k -ac 2 -i "${filePath}" "${wavPath}"`;

//     exec(cmd, (error, stdout, stderr) => {
//       if (error) {
//         console.error(`FFmpeg failed for ${filePath}:`, stderr);
//         reject(error);
//         return;
//       }

//       logger.info(`Converted ${user}'s audio file to ${wavPath}`);
//       resolve(wavPath); // return the path of the wav file
//     });
//   });
// }

export async function convertMultipleOggToMka(guildDir: string, timestamp: number): Promise<string> {
  const audioFiles: string[] = [];

  // recursive func that discovers all pcm files
  function walk(dir: string) {
    for (const file of fs.readdirSync(dir)) {
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isDirectory()) {
        walk(filePath);
      } else if (filePath.includes(`${timestamp}.ogg`)) {
        audioFiles.push(filePath);
      }
    }
  }
  walk(guildDir);

  if (audioFiles.length === 0) {
    throw new Error(`No .ogg files found for timestamp ${timestamp}`);
  }

  const outputPath = path.join(guildDir, `combined_${timestamp}.mka`);
  const ffmpegArgs: string[] = [];

  for (const file of audioFiles) {
    ffmpegArgs.push("-i", file);
  }

  for (const [index, value] of audioFiles.entries()) {
    ffmpegArgs.push("-map", `${index}:a`);
    const userId = path.basename(path.dirname(value)); 
    ffmpegArgs.push(`-metadata:s:a:${index}`, `title=${userId}`);
  }

  // // normalize length of all pcm files and set up args
  // let maxSize = 0;
  // for (const file of pcmFiles) {
  //   ffmpegArgs.push("-f", "s16le", "-ar", "48k", "-ac", "2", "-i", file);
  //   const size = fs.statSync(file).size;
  //   if (size > maxSize) {
  //     maxSize = size;
  //   }
  // }
  // for (const [index, value] of pcmFiles.entries()) {
  //   await padPcmFile(value, maxSize);
    
  //   ffmpegArgs.push("-map", `${index}:a`);
  //   ffmpegArgs.push(`-metadata:s:a:${index}`, `title=${path.basename(path.dirname(value))}`);
    
  //   // ffmpegArgs.push(`-filter:a:${index}`, "dynaudnorm,highpass=f=200,lowpass=f=4000");
  // }
  ffmpegArgs.push(
    "-c:a", "copy",
    "-y",
    outputPath,
  );

  return new Promise<string>((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", ffmpegArgs);
    let errorOutput = "";

    ffmpeg.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        logger.error(`FFmpeg Error Log: \n${errorOutput}`);
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });
    
    ffmpeg.on("error", (err) => {
      // logger.error("Failed to start FFmpeg process:", err);
      reject(err);
    });
  });
}
