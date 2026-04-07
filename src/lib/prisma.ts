import { logger } from "../utils/logger.js";

let _prisma: any = null;

export async function getPrisma() {
  if (!_prisma) {
    const { PrismaClient } = await import("../generated/prisma/client.js");
    // @ts-expect-error Prisma 7 type mismatch
    _prisma = new PrismaClient();
  }
  return _prisma;
}
