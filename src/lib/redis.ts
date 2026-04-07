import IORedis from "ioredis";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

let redis: any = null;

export function getRedis(): any {
  if (!redis) {
    redis = new (IORedis as any)(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > 5) return null;
        return Math.min(times * 500, 3000);
      },
      lazyConnect: true,
    });

    redis.on("connect", () => logger.info("Redis conectado"));
    redis.on("error", (err: any) => logger.warn({ err: err.message }, "Redis erro"));
  }
  return redis;
}

export async function connectRedis() {
  const r = getRedis();
  try {
    await r.connect();
    logger.info({ url: env.REDIS_URL.replace(/\/\/.*@/, "//***@") }, "Redis pronto");
  } catch (err: any) {
    logger.warn({ err: err.message }, "Redis indisponível na inicialização — reconecta automaticamente");
  }
}

export async function isRedisReady(): Promise<boolean> {
  try {
    const r = getRedis();
    await r.ping();
    return true;
  } catch {
    return false;
  }
}
