import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionResolvable, AutocompleteInteraction } from 'discord.js'

interface Command {
  data: SlashCommandBuilder
  execute(interaction: ChatInputCommandInteraction): Promise<void>
  autocomplete?(interaction: AutocompleteInteraction): Promise<void>
  permissions?: PermissionResolvable
}

export { Command }