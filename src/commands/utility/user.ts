import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js'

module.exports = {
  data: new SlashCommandBuilder().setName('user').setDescription('Provides information about the user.'),
  async execute(interaction: ChatInputCommandInteraction) {
    if (interaction.inCachedGuild()) {
      await interaction.reply('Use this bot in discord servers only!')
      return
    }

    const member: GuildMember =
      interaction.guild!.members.cache.get(interaction.user.id) ?? (await interaction.guild!.members.fetch(interaction.user.id))

    await interaction.reply(`This command was run by ${interaction.user.username}, who joined on ${member.joinedAt?.toDateString()}.`)
  },
};