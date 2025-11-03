import { ChatInputCommandInteraction, SlashCommandBuilder, GuildMember, GatewayIntentBits, Client, InteractionCallback } from "discord.js";
import { joinVoiceChannel, getVoiceConnection } from '@discordjs/voice'

const data = new SlashCommandBuilder().setName('join').setDescription('Allows the bot to join the same channel as the user.');

async function execute(interaction: ChatInputCommandInteraction) {


    const member = interaction.member as GuildMember;
    const channel = member.voice?.channel;
    const channel_id = member.voice?.channelId;

    if(!channel) {return}
    if(!channel_id) {return}

    const alreadyConnected = getVoiceConnection(interaction.guildId!);
    if (alreadyConnected) {
    alreadyConnected.destroy();
  }
    
    joinVoiceChannel({
        debug: true,
        adapterCreator: channel?.guild.voiceAdapterCreator,
        channelId: channel_id,
        guildId: channel?.guild.id,
        selfDeaf: false
    
    });

    console.log(`joined ${channel.name}, id: ${channel_id}`);

}

export {data, execute}