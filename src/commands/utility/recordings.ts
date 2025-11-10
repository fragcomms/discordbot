// NOT A SLASH COMMAND, IT HOLDS THE recording object that /record and /stop-recording use
import {User,} from 'discord.js'
import ffmpeg from 'ffmpeg-static'
import { OpusStream } from 'prism-media/typings/opus.js'

export interface Recording {
    opusStream: OpusStream;
    filePath: string;   // filePath
    user: User;         // User object 
    
}

export function logRecordingsState() {
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

export const recordings = new Map<string, Recording[]>();   // <guildId, array of recordings>






