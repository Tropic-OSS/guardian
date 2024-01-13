import Keyv from "keyv";
import { PrismaClient } from "@prisma/client";

export const cache = new Keyv().on("error", (err) => {
  logger.error("Keyv connection error:", err);
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
