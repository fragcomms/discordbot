/* eslint-disable @typescript-eslint/no-unused-vars */
// clean these imports after fully functional command
import { EndBehaviorType, getVoiceConnection, VoiceReceiver } from "@discordjs/voice";
import {
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  Guild,
  GuildMember,
  InteractionCallback,
  MembershipScreeningFieldType,
  MessageFlags,
  SlashCommandBuilder,
  User,
  VoiceChannel,
} from "discord.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as prism from "prism-media";
import { logRecordings, Recording, recordings } from "../utility/recordings.js";
import { spawn } from 'child_process'
// import ffmpeg from "ffmpeg-static";
// import { OpusStream } from 'prism-media/typings/opus.js';
// import { Channel, channel } from 'node:diagnostics_channel';
// import { UDPIntegrityMonitor } from "../../monitor/upd_integrity_monitor.js";
// import { Transform, TransformCallback } from 'node:stream';
import { pipeline } from "node:stream/promises";
import { logger } from "../../utils/logger.js";
import { buildEmbed } from "../utility/messages.js";
import { PCMSilencePadder } from "../utility/pcm-padder.js";
import { Writable } from 'node:stream';

// const ffmpegPath = ffmpeg as unknown as string;



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const data = new SlashCommandBuilder()
  .setName("record")
  .setDescription("Records voices in a voice channel.")
  .addUserOption((option) =>
    option
      .setName("user1")
      .setDescription("User to be recorded")
      .setRequired(true)
  )
  .addUserOption((option) =>
    option
      .setName("user2")
      .setDescription("User to be recorded")
  )
  .addUserOption((option) =>
    option
      .setName("user3")
      .setDescription("User to be recorded")
  )
  .addUserOption((option) =>
    option
      .setName("user4")
      .setDescription("User to be recorded")
  )
  .addUserOption((option) =>
    option
      .setName("user5")
      .setDescription("User to be recorded")
  )
  .addUserOption((option) =>
    option
      .setName("user6")
      .setDescription("User to be recorded")
  );

// const udpMonitors = new Map<string, UDPIntegrityMonitor>();

// REQUIRED: FFmpeg installed on machine!!!!!!!!
async function createListeningStream(
  receiver: VoiceReceiver,
  user: User,
  guildId: string,
  channelId: string,
  filePrefix: string,
  commandStartTime: number,
  startIso: string,
) {
  // Initialize monitor for this user
  // const udpMonitor = new UDPIntegrityMonitor();
  // udpMonitors.set(user.id, udpMonitor);

  const opusStream = receiver.subscribe(user.id, {
    end: { behavior: EndBehaviorType.Manual },
  });

  const decoder = new prism.opus.Decoder({
    rate: 48000,
    channels: 1,
    frameSize: 960,
  });

  const originalDecode = (decoder as any)._decode.bind(decoder);
  (decoder as any)._decode = function(chunk: Buffer) {
    try {
      return originalDecode(chunk);
    } catch (err) {
      return Buffer.alloc(0);
    }
  };

  const dataDir = path.join(process.cwd(), "data", guildId, channelId, user.id);
  fs.mkdirSync(dataDir, { recursive: true });

  const filePath = path.join(dataDir, `${filePrefix}.ogg`);
  // const outputStream = fs.createWriteStream(filePath);

  const ffmpegProcess = spawn('ffmpeg', [
    '-loglevel', 'error',
    '-f', 's16le',
    '-ar', '48000',
    '-ac', '1',
    '-i', 'pipe:0',
    '-c:a', 'libopus',
    '-b:a', '24k',
    '-vbr', 'on',
    '-y',
    filePath
  ]);

  ffmpegProcess.stderr.on("data", (chunk: Buffer) => {
    logger.error(`[FFmpeg Error - ${user.username}]: ${chunk.toString()}`);
  });

  opusStream.on("error", (error) => {
    logger.error(`[AudioStream Error - ${user.username}]:`, error);
  });

  const silencePadder = new PCMSilencePadder(commandStartTime);

  // opusStream.on("data", (chunk: Buffer) => {
  //   udpMonitor.createMonitoredPacket(chunk);
  //   if (udpMonitor.getStatistics().totalPackets % 500 === 0) udpMonitor.logStats();
  // });

  pipeline(
    opusStream,
    decoder,
    silencePadder,
    ffmpegProcess.stdin
  ).catch((err) => {
    if (err.code === "ERR_STREAM_PREMATURE_CLOSE") {
      logger.info(`Recording successfully stopped for ${user.username}`);
      return;
    }
    logger.error(`Pipeline crashed for ${user.username}:`, err);
  });

  const rec: Recording = {
    opusStream,
    decoder,
    padder: silencePadder,
    outputStream: ffmpegProcess.stdin,
    ffmpegProcess: ffmpegProcess,
    filePath,
    user,
    timestamp: startIso,
    latency: 0,
    filePrefix: filePrefix,
  };

  if (!recordings.has(guildId)) {
    recordings.set(guildId, []);
  }
  recordings.get(guildId)!.push(rec);
  logRecordings();
}

async function execute(interaction: ChatInputCommandInteraction) {
  // check if interaction is in guild
  if (!interaction.inCachedGuild()) {
    await interaction.reply({
      embeds: [buildEmbed("Use this bot in discord servers only!", 0xFF0000)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  // check if bot is in voice channel
  if (!interaction.guild.members.me?.voice.channel) {
    await interaction.reply({
      embeds: [buildEmbed("I am not in a voice channel!", 0xFF0000)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  // check if user is in voice channel
  if (!interaction.member.voice.channel) {
    await interaction.reply({
      embeds: [buildEmbed("You are not in a voice channel!", 0xFF0000)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  // check if user is in same voice channel as bot
  if (interaction.member.voice.channel.id !== interaction.guild.members.me.voice.channel.id) {
    await interaction.reply({
      embeds: [buildEmbed("You must be in the same voice channel as me to use this command!", 0xFF0000)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  // check if recording already in progress in this guild
  const guildRecordings = recordings.get(interaction.guildId!); // for this guild
  if (guildRecordings && guildRecordings.length > 0) { // if recordings in progress
    await interaction.reply({
      embeds: [
        buildEmbed(
          "Recording already in progress.\nPlease stop current recording before starting another one.",
          0xFF0000,
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });

    return;
  }

  // grab all users that were given in command
  const userOptionNames = Array.from({ length: 6 }, (_, i) => `user${i + 1}`);
  const users = userOptionNames
    .map(name => interaction.options.getUser(name))
    .filter((u): u is import("discord.js").User => u !== null);

  await interaction.reply({
    embeds: [buildEmbed(`Recording users: \n${users.map(u => `<@${u.id}>`).join(",\n")}`, 0xFACC15)], // T yellow for "in progress"
  });

  const connection = getVoiceConnection(interaction.guildId)!;
  const receiver = connection.receiver;

  const epochStartTime = interaction.createdTimestamp;
  const startIso = new Date(epochStartTime).toISOString();
  const filePrefix = Date.now().toString();

  const commandStartTime = performance.now();

  // for each user, create a listening stream
  for (const user of users) {
    logger.info(`Listening to ${user.username}`);
    createListeningStream(
      receiver,
      user,
      interaction.guildId,
      interaction.guild.members.me.voice.channel.id,
      filePrefix,
      commandStartTime,
      startIso,
    );
  }
}

export { data, execute };
