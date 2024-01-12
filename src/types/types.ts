import zod from 'zod';

export const ConfigSchema = zod.object({
    Bot: zod.object({
        token: zod.string(),
        prefix: zod.string(),
        guildID: zod.string(),
    }),
});