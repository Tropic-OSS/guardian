import { z } from "zod";
import { logger } from "./logger";

const MojangProfileSchema = z.object({
    id: z.string(),
    name: z.string()
});

export async function getMojangProfileByUsername(username: string) {
    try {
        const response = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);

        if (response.status !== 200) {
            return null;
        }

        return MojangProfileSchema.parseAsync(await response.json());
    } catch (error) {
        logger.error(error);
        return null;
    }
}

export async function getMojangProfileById(id: string) {
    try {
        const response = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${id}`);

        if (response.status !== 200) {
            return null;
        }

        return MojangProfileSchema.parseAsync(await response.json());
    } catch (error) {
        logger.error(error);
        return null;
    }
}

export function addDashes(id: string) {
    try {
        const regex = /([0-9a-fA-F]{8})([0-9a-fA-F]{4})([0-9a-fA-F]{4})([0-9a-fA-F]{4})([0-9a-fA-F]+)/g;
        const subst = '$1-$2-$3-$4-$5';
        return id.replace(regex, subst);;
    } catch (error) {
        logger.error(error);
        return null;
    }
}