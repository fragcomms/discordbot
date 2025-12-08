const { 
  Client, 
  GatewayIntentBits 
} = require("discord.js");

const {
  joinVoiceChannel,
  getVoiceConnection,
  entersState,
  VoiceConnectionStatus,
  EndBehaviorType,
  createAudioPlayer
} = require("@discordjs/voice");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
  ]
});

// Track last sequence per SSRC
const lastSeq = new Map();

function inspectPacket(buffer, ssrc) {
  // SRTP-style RTP header:
  // byte 2-3 = sequence number
  // byte 4-7 = timestamp

  const seq = buffer.readUInt16BE(2);
  const timestamp = buffer.readUInt32BE(4);

  const prev = lastSeq.get(ssrc);
  let loss = 0;

  if (prev !== undefined) {
    const expected = (prev + 1) & 0xFFFF;
    if (seq !== expected) {
      loss = (seq - expected) & 0xFFFF;

      console.log(
        `⚠️  Packet loss detected for SSRC ${ssrc}: expected ${expected}, got ${seq}, lost ${loss}`
      );
    }
  }

  lastSeq.set(ssrc, seq);

  console.log(
    `Packet | SSRC=${ssrc} | Seq=${seq} | Timestamp=${timestamp} | Size=${buffer.length}`
  );
}

client.on("voiceStateUpdate", async (oldState, newState) => {
  // Auto-join when bot is summoned
  if (
    newState.member.id === client.user.id &&
    newState.channelId &&
    !getVoiceConnection(newState.guild.id)
  ) {
    joinVoiceChannel({
      channelId: newState.channelId,
      guildId: newState.guild.id,
      adapterCreator: newState.guild.voiceAdapterCreator,
    });
  }
});

client.on("ready", () => {
  console.log(`Bot logged in as ${client.user.tag}`);
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "monitor") {
    const channel = interaction.member.voice.channel;

    if (!channel)
      return interaction.reply("Join a voice channel first!");

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 5000);

    const receiver = connection.receiver;

    receiver.ssrcMap.once("update", map => {
      console.log("🔧 SSRC map updated:", map);
    });

    receiver.speaking.on("start", userId => {
      const ssrcInfo = receiver.ssrcMap.get(userId);
      if (!ssrcInfo) return;

      const ssrc = ssrcInfo.ssrc;
      console.log(`🎤 User ${userId} started speaking (SSRC ${ssrc})`);

      const stream = receiver.subscribe(userId, {
        end: { behavior: EndBehaviorType.Manual }
      });

      stream.on("data", packet => inspectPacket(packet, ssrc));
    });

    interaction.reply("Monitoring incoming voice UDP packets…");
  }
});

client.login("YOUR_BOT_TOKEN_HERE");
