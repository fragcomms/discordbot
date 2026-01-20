/* eslint-disable @typescript-eslint/no-unused-vars */
//TODO: stop recording when bot is force disconnected, this should be done for everything
import { recordings, Recording } from "./recordings.js";
import { convertMultiplePcmToMka } from "./audio-conversion.js";
import path from "node:path";
import { Client as DiscordClient } from "discord.js";
import { sendMessage } from "./messages.js";
import { Client as SCPClient } from 'node-scp'
import { Pool as PGPool } from 'pg'
import dotenv from 'dotenv'
dotenv.config()

/**
 * decided to refactor the code - aaron
 * wanted to make it cleaner considering we had SCP
 * and SQL queries in one block of code
 */
class SCPManager {
  private config; // very important secrets!!!!

  constructor() {
    this.config = {
      host: process.env.SCP_HOST,
      port: process.env.SCP_PORT,
      username: process.env.SCP_USER,
      password: process.env.SCP_PASS,
    }
  }

  public async transferAudio(localPath: string, remoteDir: string, remoteFileName: string): Promise<boolean> {
    try {
      const scp = await SCPClient(this.config)
      const remotePath = `${remoteDir}/${remoteFileName}`
      if (!(await scp.exists(remoteDir))) {
        console.log(`Creating remote directory: ${remoteDir}`)
        await scp.mkdir(remoteDir, undefined, { recursive: true })
        // recursive mkdir required because of new server ids
      }

      console.log(`Uploading ${localPath} to ${remotePath}...`)
      await scp.uploadFile(localPath, remotePath)
      console.log("Upload successful")
      scp.close()

      return true
    } catch (e) {
      console.error("Transfer failed:", e)
      return false
    }
  }
}

//postgres connection and query manager
class PGManager {
  private pool: PGPool;

  constructor() {
    this.pool = new PGPool({
      user: process.env.PG_USER,
      password: process.env.PG_PASS,
      host: process.env.PG_HOST,
      database: process.env.PG_DB,
    })
  }

  // separating these connects gives more clarity in the code
  // public async connect(): Promise<void> {
  //   await this.postgres.connect()
  //   console.log("Connected to DB");
  // }

  // public async disconnect(): Promise<void> {
  //   await this.postgres.end()
  //   console.log("Disconnected from DB");
  // }

  public async shutdown(): Promise<void> {
    await this.pool.end()
    console.log("Database pool shut down");
  }

  // returns newId or null, null to show it failed
  public async insertAudioRecord(fileExt: string, remotePath: string, timestamp: number): Promise<string | null> {
    try {
      const query = `
        INSERT INTO public.audios (file_ext, file_path, sampling_rate, creation_time) 
        VALUES ($1, $2, $3, $4) 
        RETURNING audio_id;`
      const values = [fileExt, remotePath, '20000', new Date(timestamp)];
      // all sampling rate will default to 20000, may change later in the future
      const res = await this.pool.query(query, values);
      
      const newId = res.rows[0]?.audio_id;
      console.log(`Inserted Audio Record. ID: ${newId}`);
      return newId;
    } catch (e) {
      console.log("Failed to insert audio record:", e)
      return null;
    }
  }

  // makes sure that the user exists
  public async ensureUserExists(discordId: string, username: string, timestamp: number): Promise<void> {
    try {
      const query = `
        INSERT INTO public.users (discord_id, created_at, discord_username) 
        VALUES ($1, $2, $3) 
        ON CONFLICT (discord_id) DO NOTHING;`
      // frankly i dont like this "do nothing"
      // may change in future
      await this.pool.query(query, [discordId, new Date(timestamp), username]);
    } catch (e) {
      console.error(`Failed to ensure user ${username} exists:`, e)
    }
  }

  // updates media_access tables to allow recorded users to fetch audio
  public async grantUserAccess(discordId: string, audioId: string): Promise<void> {
    try {
      const query = `
        INSERT INTO public.media_access (discord_id, audio_id) 
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING;`
      // ok i actually dont like this conflict one,
      // im not even sure if i want it in this as its
      // theoretically impossible to get a duplicate entry
      await this.pool.query(query, [discordId, audioId])
    } catch (e) {
      console.error(`Failed to grant access for user ${discordId}:`, e)
    }
  }
}

/**
 * manages the lifecycle of a recording session, including stopping active streams,
 * finalizing audio files, uploading to storage, and updating the database.
 */
export class RecordingSessionManager {
  // dont want any exploits to get access to db/scp
  private db: PGManager
  private scp: SCPManager

  constructor() {
    this.db = new PGManager
    this.scp = new SCPManager
  }

  // grabs all active recordings and destroys them
  private stopActiveStreams(guildRecordings: Recording[], client: DiscordClient, channelId: string) {
    for (const recording of guildRecordings) {
      try {
        recording.opusStream.destroy()
      } catch (error) {
        console.error(error)
        sendMessage(client, channelId, `Could not stop recording for ${recording.user.username}:`);
      }
    }
  }

  // saves the recordings to database
  private async saveToDatabase(guildRecordings: Recording[], remoteFullPath: string, timestamp: number) {
    try {

      const audioId = await this.db.insertAudioRecord('mka', remoteFullPath, timestamp)

      if (audioId) {
        // makes sure all users getting recorded get their proper permissions and tables inside our database
        for (const recording of guildRecordings) {
          await this.db.ensureUserExists(recording.user.id, recording.user.username, timestamp)
          await this.db.grantUserAccess(recording.user.id, audioId)
        }
      }
    } catch (e) {
      console.error("Database Transaction Failed", e)
    }
  }

  // ends recording session
  public async endSession(guildId: string, channelId: string, voiceChannelId: string, client: DiscordClient) {
    const guildRecordings = recordings.get(guildId)

    if (!guildRecordings || guildRecordings.length === 0) {
      console.log(`No recordings in progress`);
      return;
    }

    this.stopActiveStreams(guildRecordings, client, channelId)

    // vars to help make it plug and play
    const timestamp = Number(guildRecordings[0].timestamp);
    const localDir = path.join(process.cwd(), 'data', guildId, voiceChannelId)
    const wavPath = await convertMultiplePcmToMka(localDir, timestamp)

    sendMessage(client, channelId, `Compiled all user's recordings to one: ${wavPath}`)

    // ex: /home/user/bigserverid/bigchannelid/timestamp
    const remoteDir = `${process.env.SCP_DIR}/${guildId}/${voiceChannelId}/${timestamp}`;
    const remoteFileName = `audio.mka`;
    // ex: /home/user/bigserverid/bigchannelid/timestamp/audio.mka
    const remoteFullPath = `${remoteDir}/${remoteFileName}`;

    const uploadSuccess = await this.scp.transferAudio(wavPath, remoteDir, remoteFileName)

    if (uploadSuccess) {
      await this.saveToDatabase(guildRecordings, remoteFullPath, timestamp)
    } else {
      sendMessage(client, channelId, "Audio processing finished, but upload to storage server failed.")
    }

    recordings.delete(guildId)
    //TODO: cleanup
  }
}

const sessionManager = new RecordingSessionManager()

export async function cleanUpProcess(guildId: string, channelId: string, voiceChannelId: string, client: DiscordClient) {
  await sessionManager.endSession(guildId, channelId, voiceChannelId, client);
}


/*

1. STOP RECORDING
2. FINALIZE AUDIO
3. SEND MESSAGE

*/


