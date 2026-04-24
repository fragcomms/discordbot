 
// NOT A SLASH COMMAND, IT HOLDS THE recording object that /record and /stop-recording use
import { AudioReceiveStream } from "@discordjs/voice";
import { User } from "discord.js";
// import * as fs from "node:fs";
import * as prism from "prism-media";
import { logger } from "../../utils/logger.js";
import { Writable, Transform } from "node:stream";
import { ChildProcess } from "node:child_process";
// import { OpusStream } from 'prism-media/typings/opus.js'

export interface Recording {
  opusStream: AudioReceiveStream;
  decoder: prism.opus.Decoder;
  padder: Transform;
  outputStream: Writable;
  ffmpegProcess: ChildProcess;
  filePath: string; // filePath
  user: User; // User object
  timestamp: string;
  latency: number;
  filePrefix: string;
}

export function logRecordings() {
  logger.info("\nCurrent recordings state:");
  for (const [channelId, recs] of recordings.entries()) {
    logger.info(`Channel ${channelId}:`);
    for (const rec of recs) {
      logger.info(
        `- ${rec.user.username} → ${rec.filePath} [stream active: ${!rec.opusStream.destroyed}]`,
      );
    }
  }
}

// // stop all recordings (in case bot disconnects/crashes)
// export async function stopRecordings(guildId: string) {

// }

// Map of <guildId, Recording[]>
export const recordings = new Map<string, Recording[]>();
