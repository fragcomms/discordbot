/* eslint-disable @typescript-eslint/no-unused-vars */
// NOT A SLASH COMMAND, IT HOLDS THE recording object that /record and /stop-recording use
import { AudioReceiveStream } from '@discordjs/voice';
import { User } from 'discord.js'
import ffmpeg from 'ffmpeg-static'
// import { OpusStream } from 'prism-media/typings/opus.js'
import { ChildProcess } from 'node:child_process';

export interface Recording {
    opusStream: AudioReceiveStream;
    filePath: string;   // filePath
    user: User;        // User object 
    timestamp: string;
}

export function logRecordings() {
  console.log("\n📜 Current recordings state:");
  for (const [channelId, recs] of recordings.entries()) {
    console.log(`  Channel ${channelId}:`);
    for (const rec of recs) {
      console.log(
        `    - ${rec.user.username} → ${rec.filePath} [stream active: ${!rec.opusStream.destroyed}]`
      );
    }
  }
  console.log("──────────────────────────────\n");
}

// // stop all recordings (in case bot disconnects/crashes)
// export async function stopRecordings(guildId: string) { 

// }

// Map of <guildId, Recording[]>
export const recordings = new Map<string, Recording[]>();

export const monitors = new Map<string, ChildProcess>();






