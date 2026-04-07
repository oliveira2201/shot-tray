import { PrismaClient } from "../generated/prisma/client.js";

// @ts-expect-error Prisma 7 type mismatch
export const prisma: InstanceType<typeof PrismaClient> = new PrismaClient();
