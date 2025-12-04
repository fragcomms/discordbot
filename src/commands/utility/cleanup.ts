//TODO: stop recording when bot is force disconnected, this should be done for everything
import { recordings } from "./recordings.js";
import { convertMultiplePcmToMka } from "./audio-conversion.js";
import fs from "node:fs";
import path from "node:path";
import { Client } from "discord.js";
import { sendMessage } from "./messages.js";


//CLEANUP PROCESS
// stop all recordings, finalize audio files, send messages
export async function cleanUpProcess(guildId : string, channelId: string, client: Client) {
    const guildRecordings = recordings.get(guildId);
    if (!guildRecordings || guildRecordings.length == 0) {
        console.log(`No recordings in progress`);
        return;
    }
     //STOP AND PROCESS ALL ACTIVE RECORDINGS
  for (const recording of guildRecordings) {       // iterate through all active recordings
    try {
      recording.opusStream.destroy();     // stop the stream
    }
    catch (error) {
      console.error(error)
      await sendMessage(client, channelId, `Could not stop recording for ${recording.user.username}:`);
    }
  }
  const wavPath = await convertMultiplePcmToMka(path.join(process.cwd(), 'data', guildId), guildRecordings[0].timestamp)
  sendMessage(client, channelId, `Compiled all user's recordings to one: ${wavPath}`);
  recordings.delete(guildId) // delete once finished, we don't need to keep old streams
  //TODO: add cleanupdirectory functionality
}

export function cleanUpDirectory(directory: string) {
  cleanOldDataFiles(directory, ".pcm");
  cleanOldDataFiles(directory, ".mka");
  cleanOldDataFiles(directory, ".wav");
}

//clean data files older than set time 
export function cleanOldDataFiles(directory: string, fileExtension: string ) {

  const setTimeHours = 48;
  const ageThreshholdinMS = 1000 * 60 * 60 * setTimeHours; // 48 hours
  // const ageThreshholdinMS = 1000*60*5; // 5 mins
  const now = Date.now();
  let totalDump = 0;
  

  //check if directory exists
  if(!fs.existsSync(directory)) {
    console.log(`Directory ${directory} not found.`);
    return;
  }

  //read and iterate through files in directory
  const files = RecursiveFileSearch(directory);

  for (const filePath of files) {

    if(!filePath.endsWith(fileExtension)) {
      continue;
    }

    const stats = fs.statSync(filePath);
    const fileAge = now - stats.mtimeMs;
    const fileSize = stats.size; // size in bytes
    totalDump += fileSize; // add to total dump

    const fileInfo = fileSizeConversion(fileSize)

    //delete file 
    //show size of deletions in console. can be taken out.
    if(fileAge > ageThreshholdinMS) {
      console.log(`🗑️ Deleting: ${filePath} - ${fileInfo}`);
      fs.rmSync(filePath, {recursive: true, force: true});
    }
  }

  if(totalDump == 0) {
    console.log(`No ${fileExtension} files were deleted.`);
    return;
  }

  const totalDumpInfo = fileSizeConversion(totalDump);
  console.log(`✅ Old file cleanup in ${directory} completed.`);
  console.log(`Size of all deleted files: ${totalDumpInfo}`);

}



//helper function for getting all files in the data folder
function RecursiveFileSearch(directory: string): string[] {
  let fileList : string[] = [];

  const list = fs.readdirSync(directory);
  for (const item of list) {
    const filePath = path.join(directory, item);
    const stats = fs.statSync(filePath);
    
    if(stats.isDirectory()) {
      // if folder, call function recursively on folder
      fileList = fileList.concat(RecursiveFileSearch(filePath));
    }
    else {
      //else, grab file, put in fileList
      fileList.push(filePath);
    }
  }

  return fileList;

}

// helper function - returns file size and correct units as a string
function fileSizeConversion(fileSize: number): string {
  let fileSizeUnits = "bytes";
  
  if (fileSize >= 1073741824) { // 1 GB or greater
      fileSize = fileSize / 1024 / 1024 / 1024; //convert
      fileSizeUnits = "GB";
    }
    else if (fileSize >= 1048576) { // 1 MB or greater
      fileSize = fileSize / 1024 / 1024;
      fileSizeUnits = "MB";

    }
    else if (fileSize >= 1024) { // 1 KB or greater
      fileSize = fileSize / 1024;
      fileSizeUnits = "KB";

    }
    // else, fileSize is alreay in bytes

  const convertedString = (`${fileSize} ${fileSizeUnits}`);
  return convertedString;

}






/*

1. STOP RECORDING
2. FINALIZE AUDIO
3. SEND MESSAGE

*/


