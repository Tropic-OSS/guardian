import { Client, Events } from "discord.js";
import { logger } from "../lib/logger";

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client: Client<true>) {

    logger.info(`Ready! Logged in as ${client.user.tag}`);
  },
};