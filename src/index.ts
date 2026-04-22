import { ShardingManager } from "discord.js";
import "dotenv/config";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "./utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isTs = __filename.endsWith(".ts");

const manager = new ShardingManager(path.join(__dirname, "bot.ts"), {
  token: process.env.DISCORD_TOKEN,
  totalShards: "auto", // Automatically scales based on the number of servers the bot is in
  // might change later
  execArgv: isTs ? ["--import", "tsx"] : [],
});

manager.on("shardCreate", (shard) => {
  logger.info(`[ShardManager] Launched shard #${shard.id}`);
});

manager.spawn().catch((err) => {
  logger.error("[ShardManager] Sharding failed to spawn:", err);
});
