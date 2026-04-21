// test command
import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder, MessageFlags } from "discord.js";
import { buildEmbed } from "./messages.js";

const data = new SlashCommandBuilder().setName("user").setDescription("Provides information about the user.");

async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.inCachedGuild()) {
    await interaction.reply({ 
      embeds: [buildEmbed("Use this bot in discord servers only!", 0xFF0000)],
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  const member: GuildMember = interaction.guild?.members.cache.get(interaction.user.id)
    ?? (await interaction.guild!.members.fetch(interaction.user.id));
  await interaction.reply({ 
    embeds: [buildEmbed(`This command was run by <@${interaction.user.id}>, who joined on ${member.joinedAt?.toDateString()}`, 0x3399FF)]
  });
}

export { data, execute };
