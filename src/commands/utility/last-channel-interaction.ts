//stores the text channel where /join was last used in the server.
//quick fix for now, needed for the sendMessage function inaide cleanUpProcess

export const lastChannelInteraction = new Map<string, string>();   // <guildId, channel>

