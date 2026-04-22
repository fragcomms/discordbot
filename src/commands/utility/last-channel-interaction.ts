// stores the text channel where /join was last used in the server.
// quick fix for now, needed for the sendMessage function inaide cleanUpProcess
import { Client } from "discord.js";

// defunct? (will visit later)
export const lastChannelInteraction = new Map<string, string>(); // <guildId, channel>

// track last channel interaction
export interface GuildState {
  guildId: string;
  lastVoiceChannelId?: string;
  lastTextChannelId?: string;
  client?: Client;
}

// map, key: guildId; value: GuildState
export const guildStates = new Map<string, GuildState>();

// setter
export function setGuildState(guildId: string, state: Partial<GuildState>) {
  const current = guildStates.get(guildId) || { guildId };
  guildStates.set(guildId, { ...current, ...state });
}

// getter
export function getGuildState(guildId: string): GuildState | undefined {
  return guildStates.get(guildId);
}

// will refactor later
