/* eslint-disable @typescript-eslint/no-unused-vars */
//TODO: stop recording when bot is force disconnected, this should be done for everything
import { recordings, Recording } from "./recordings.js";
import { convertMultiplePcmToMka } from "./audio-conversion.js";
import path from "node:path";
import { Client as DiscordClient } from "discord.js";
import { sendMessage } from "./messages.js";
import { Client as SCPClient } from 'node-scp'
import { Client as PGClient } from 'pg'
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
  private postgres: PGClient;

  constructor() {
    this.postgres = new PGClient({
      user: process.env.PG_USER,
      password: process.env.PG_PASS,
      host: process.env.PG_HOST,
      database: process.env.PG_DB,
    })
  }

  // separating these connects gives more clarity in the code
  public async connect(): Promise<void> {
    await this.postgres.connect()
    console.log("Connected to DB");
  }

  public async disconnect(): Promise<void> {
    await this.postgres.end()
    console.log("Disconnected from DB");
  }

  // returns newId or null, null to show it failed
  public async insertAudioRecord(fileExt: string, remotePath: string, timestamp: number): Promise<string | null> {
    try {
      const query = `
        INSERT INTO public.audios (file_ext, path, sampling_rate, creation_time) 
        VALUES ($1, $2, $3, $4) 
        RETURNING audio_id;`
      const values = [fileExt, remotePath, '20000', new Date(timestamp)];
      // all sampling rate will default to 20000, may change later in the future
      const res = await this.postgres.query(query, values);
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
      await this.postgres.query(query, [discordId, new Date(timestamp), username]);
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
      await this.postgres.query(query, [discordId, audioId])
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
      await this.db.connect()

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
    } finally {
      await this.db.disconnect()
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

    // ex: /home/user/bigserverid/bigchannelid
    const remoteDir = `${process.env.SCP_DIR}/${guildId}/${voiceChannelId}`;
    // ex: bigtimestamp.mka
    const remoteFileName = `${timestamp}.mka`;
    // ex: /home/user/bigserverid/bigchannelid/bigtimestamp.mka
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



























// //CLEANUP PROCESS
// // stop all recordings, finalize audio files, send messages
// export async function cleanUpProcess(guildId: string, channelId: string, voiceChannelId: string, client: DiscordClient) {
//   const guildRecordings = recordings.get(guildId);
//   if (!guildRecordings || guildRecordings.length == 0) {
//     console.log(`No recordings in progress`);
//     return;
//   }
//   //STOP AND PROCESS ALL ACTIVE RECORDINGS
//   for (const recording of guildRecordings) {       // iterate through all active recordings
//     try {
//       recording.opusStream.destroy();     // stop the stream
//     }
//     catch (error) {
//       console.error(error)
//       await sendMessage(client, channelId, `Could not stop recording for ${recording.user.username}:`);
//     }
//   }
//   const wavPath = await convertMultiplePcmToMka(path.join(process.cwd(), 'data', guildId, voiceChannelId), Number(guildRecordings[0].timestamp))
//   sendMessage(client, channelId, `Compiled all user's recordings to one: ${wavPath}`);
//   //send file to backend
//   //insert into database

//   const remoteDir = `${process.env.SCP_DIR}/${guildId}/${voiceChannelId}`; // directory of path to server
//   const remoteFile = `${remoteDir}/${guildRecordings[0].timestamp}.mka`; // file name

//   /**
//    * im sure if there is a better way to do this, but i made it so that
//    * each and every step (scp file transfer and db insertions) is linear so that way 
//    * it breaks the least
//    */
//   //scp INTO SERVER and TRANSFER .mka
//   (async () => {
//     try {
//       const scp = await SCPClient({
//         host: process.env.SCP_HOST,
//         port: process.env.SCP_PORT,
//         username: process.env.SCP_USER,
//         password: process.env.SCP_PASS,
//       })
//       // if the scp client connected properly
//       if (!(await scp.exists(remoteDir))) {
//         console.log(`Creating ${remoteDir}`)
//         await scp.mkdir(remoteDir, undefined, { recursive: true })
//       }
//       console.log(`Uploading ${wavPath} to ${remoteFile}...`)
//       await scp.uploadFile(wavPath, remoteFile)
//       console.log('Upload successful')
//       scp.close() // closes connection after its finished
//     } catch (e) {
//       console.log("Transfer failed:", e)
//       return;
//     }
//   })();

//   // connect to DB and insert audio, ownership, and create user if required
//   (async () => {
//     try {
//       const postgres = new PGClient({
//         user: process.env.PG_USER,
//         password: process.env.PG_PASS,
//         host: process.env.PG_HOST,
//         database: process.env.PG_DB,
//       })
//       await postgres.connect()
//       console.log("connected to db")
//       // creates a entry for the processed audio file
//       const insertQuery = `
//       INSERT INTO public.audios (file_ext, path, sampling_rate, creation_time) 
//       VALUES ($1, $2, $3, $4) 
//       ON CONFLICT DO NOTHING 
//       RETURNING audio_id;
//       `;
//       // postgres doesn't accept raw UNIX :'(
//       const values = ['mka', remoteFile, '20000', new Date(Number(guildRecordings[0].timestamp))];
//       const res = await postgres.query(insertQuery, values);

//       const newAudioId = res.rows[0].audio_id;
//       console.log(`Inserted Audio Record. ID: ${newAudioId}`);
//       for (const recording of guildRecordings) {
//         const userId = recording.user.id;
//         const username = recording.user.username;

//         try {
//           // PARENT OF media_access
//           // REQUIRED to create first before inserting into media_access
//           await postgres.query(`
//             INSERT INTO public.users (discord_id, created_at, discord_display_name) 
//             VALUES ($1, $2, $3) 
//             ON CONFLICT DO NOTHING;`, [
//             userId,
//             new Date(Number(guildRecordings[0].timestamp)),
//             username
//           ]);

//           await postgres.query(`
//             INSERT INTO public.media_access (discord_id, audio_id) 
//             VALUES ($1, $2);`, [
//             userId,
//             newAudioId
//           ]); // if this succeeds, we are bingo

//         } catch (err) {
//           // maybe error is specific to user
//           console.error(`Failed to link user ${username} to audio:`, err);
//         }
//       }

//       await postgres.end()
//       console.log("disconnected from db") // good practice
//     } catch (e) {
//       console.log(e)
//     }
//   })();

//   recordings.delete(guildId) // delete once finished, we don't need to keep old streams
//   //TODO: add cleanupdirectory functionality
// }

// //UNUSED ATM
// export function cleanUpDirectory(directory: string) {
//   cleanOldDataFiles(directory, ".pcm");
//   cleanOldDataFiles(directory, ".mka");
//   cleanOldDataFiles(directory, ".wav");
// }

// //clean data files older than set time 
// export function cleanOldDataFiles(directory: string, fileExtension: string) {

//   const setTimeHours = 48;
//   const ageThreshholdinMS = 1000 * 60 * 60 * setTimeHours; // 48 hours
//   // const ageThreshholdinMS = 1000*60*5; // 5 mins
//   const now = Date.now();
//   let totalDump = 0;


//   //check if directory exists
//   if (!fs.existsSync(directory)) {
//     console.log(`Directory ${directory} not found.`);
//     return;
//   }

//   //read and iterate through files in directory
//   const files = RecursiveFileSearch(directory);

//   for (const filePath of files) {

//     if (!filePath.endsWith(fileExtension)) {
//       continue;
//     }

//     const stats = fs.statSync(filePath);
//     const fileAge = now - stats.mtimeMs;
//     const fileSize = stats.size; // size in bytes
//     totalDump += fileSize; // add to total dump

//     const fileInfo = fileSizeConversion(fileSize)

//     //delete file 
//     //show size of deletions in console. can be taken out.
//     if (fileAge > ageThreshholdinMS) {
//       console.log(`Deleting: ${filePath} - ${fileInfo}`);
//       fs.rmSync(filePath, { recursive: true, force: true });
//     }
//   }

//   if (totalDump == 0) {
//     console.log(`No ${fileExtension} files were deleted.`);
//     return;
//   }

//   const totalDumpInfo = fileSizeConversion(totalDump);
//   console.log(`Old file cleanup in ${directory} completed.`);
//   console.log(`Size of all deleted files: ${totalDumpInfo}`);

// }



// //helper function for getting all files in the data folder
// function RecursiveFileSearch(directory: string): string[] {
//   let fileList: string[] = [];

//   const list = fs.readdirSync(directory);
//   for (const item of list) {
//     const filePath = path.join(directory, item);
//     const stats = fs.statSync(filePath);

//     if (stats.isDirectory()) {
//       // if folder, call function recursively on folder
//       fileList = fileList.concat(RecursiveFileSearch(filePath));
//     }
//     else {
//       //else, grab file, put in fileList
//       fileList.push(filePath);
//     }
//   }

//   return fileList;

// }

// // helper function - returns file size and correct units as a string
// function fileSizeConversion(fileSize: number): string {
//   let fileSizeUnits = "bytes";

//   if (fileSize >= 1073741824) { // 1 GB or greater
//     fileSize = fileSize / 1024 / 1024 / 1024; //convert
//     fileSizeUnits = "GB";
//   }
//   else if (fileSize >= 1048576) { // 1 MB or greater
//     fileSize = fileSize / 1024 / 1024;
//     fileSizeUnits = "MB";

//   }
//   else if (fileSize >= 1024) { // 1 KB or greater
//     fileSize = fileSize / 1024;
//     fileSizeUnits = "KB";

//   }
//   // else, fileSize is alreay in bytes

//   const convertedString = (`${fileSize} ${fileSizeUnits}`);
//   return convertedString;

// }






/*

1. STOP RECORDING
2. FINALIZE AUDIO
3. SEND MESSAGE

*/


