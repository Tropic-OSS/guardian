import { z } from "zod";

export type Responses = {
  question: string;
  content: string;
}[];

export const ConfigSchema = z.object({
  prefix: z.string().default("!"),
  token: z.string(),
  guildId: z.string(),
  clientId: z.string(),
  consoleChannel: z.string(),
  server: z
    .object({
      websocketPort: z.number(),
      apiPort: z.number(),
      token: z.string(),
    })
    .optional(),
  applications: z.object({
    timeout: z.number(),
    channel: z.string(),
    questions: z.array(z.string()),
  }),
  interviews: z
    .object({
      enabled: z.boolean(),
      role: z.string(),
      channel: z.string(),
      private: z.boolean(),
      notification: z.string(),
    })
    .optional(),
  onboarding: z.object({
    joinChannel: z.string(),
    joinMessage: z.string(),
    acceptChannel: z.string(),
    acceptMessage: z.string(),
    memberRole: z.string(),
  }),
  whitelistManager: z
    .object({
      enabled: z.boolean(),
      message: z.string(),
      vacationRole: z.string(),
      removeInactivePlayerAfterDays: z.number(),
      gracePeriodDays: z.number(),
      timezone: z.string(),
      cron: z.string(),
    })
    .optional(),
});
