import { logger } from "../utils/logger.js";

let _prisma: any = null;

export async function getPrisma() {
  if (!_prisma) {
    const { PrismaClient } = await import("../generated/prisma/client.js");
    const { PrismaPg } = await import("@prisma/adapter-pg");
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL não definido");
    }
    const adapter = new PrismaPg({ connectionString });
    _prisma = new PrismaClient({ adapter });
  }
  return _prisma;
}
