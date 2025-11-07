// test command
import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';

const data = new SlashCommandBuilder().setName('user').setDescription('Provides information about the user.')

async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.inCachedGuild()) {
    await interaction.reply('Use this bot in discord servers only!')
    return
  }

  const member: GuildMember = interaction.guild?.members.cache.get(interaction.user.id) ?? (await interaction.guild!.members.fetch(interaction.user.id))
  await interaction.reply(`This command was run by <@${interaction.user.id}>, who joined on ${member.joinedAt?.toDateString()}`)
}

export { data, execute }
