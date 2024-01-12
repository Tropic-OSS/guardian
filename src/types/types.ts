import zod from 'zod';

export const ConfigSchema = zod.object({
    bot: zod.object({
        token: zod.string(),
        prefix: zod.string(),
        guildID: zod.string(),
        clientID: zod.string(),
    }),
});