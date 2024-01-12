import { Client, Collection } from "discord.js";
import { ConfigSchema } from "./types";
import zod from "zod";

declare module "discord.js" {
  interface Client {
    config: zod.infer<typeof ConfigSchema>;
    commands: Collection;
  }
}
