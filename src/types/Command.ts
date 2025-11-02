import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionResolvable, AutocompleteInteraction } from 'discord.js'

export interface Command {
  data: SlashCommandBuilder
  execute(interaction: ChatInputCommandInteraction): Promise<void>
  autocomplete?(interaction: AutocompleteInteraction): Promise<void>
  permissions?: PermissionResolvable
}