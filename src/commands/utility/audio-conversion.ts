/* eslint-disable @typescript-eslint/no-unused-vars */
import { exec, spawn } from 'child_process';
import { dir } from 'console';
import { User } from 'discord.js';
import ffmpegPath from 'ffmpeg-static';
import fs from 'fs'
import path from 'path'

//exportable function pcm -> wav
//ONLY FOR TESTING PURPOSES
export async function convertPcmToWav(user: User, filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {

    const wavPath = filePath.replace(/\.pcm$/, '.wav');
    const cmd = `"${ffmpegPath}" -f s16le -ar 48k -ac 2 -i "${filePath}" "${wavPath}"`;

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

// helper function for convertMultiplePcmToMka
async function padPcmFile(filePath: string, targetSizeBytes: number): Promise<void> {
  const stats = fs.statSync(filePath)
  const currentSize = stats.size

  if (currentSize >= targetSizeBytes) {
    return
  }

  const paddingNeeded = targetSizeBytes - currentSize
  const silenceBuffer = Buffer.alloc(paddingNeeded, 0) // basically flood the EOF with 0 until it reaches the target size
  fs.appendFileSync(filePath, silenceBuffer)
}

export async function convertMultiplePcmToMka(guildDir: string, timestamp: number) : Promise<string>{
  const pcmFiles: string[] = []

  // recursive func that discovers all pcm files
  function walk(dir: string) {
    for (const file of fs.readdirSync(dir)) {
      const filePath = path.join(dir, file)
      if (fs.statSync(filePath).isDirectory()) {
        walk(filePath)
      } else if (filePath.includes(`${timestamp}.pcm`)) {
        pcmFiles.push(filePath)
      }
    }
  }
  walk(guildDir)

  if (pcmFiles.length === 0) {
    throw new Error(`No .pcm files found for timestamp ${timestamp}`)
  }

  const outputPath = path.join(guildDir, `combined_${timestamp}.mka`)
  const ffmpegArgs: string[] = []

  // normalize length of all pcm files and set up args
  let maxSize = 0
  for (const file of pcmFiles) {
    ffmpegArgs.push('-f', 's16le', '-ar', '48k', '-ac', '2', '-i', file)
    const size = fs.statSync(file).size
    if (size > maxSize) {
      maxSize = size
    }
  }
  for (const [index, value] of pcmFiles.entries()) {
    await padPcmFile(value, maxSize)
    ffmpegArgs.push('-map', `${index}:a`)
    ffmpegArgs.push(`-metadata:s:a:${index}`, `title=${path.basename(path.dirname(value))}`)
  }
  ffmpegArgs.push(
    '-c:a', 'libopus', 
    '-b:a', '20k', 
    '-frame_duration', '60',
    '-compression_level', '10',
    '-vbr', 'on', 
    '-af', 'dynaudnorm,highpass=f=200,lowpass=f=3000',
    '-application', 'voip',
    '-ac', '1', outputPath)

  return new Promise<string>((resolve, reject) => {
    const ffmpeg = spawn(`${ffmpegPath}`, ffmpegArgs)
    // ffmpeg.stderr.on('data', (data) => {
    //   console.log(data.toString())
    // })
    
    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve(outputPath)
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`))
      }
    })
  })
} 