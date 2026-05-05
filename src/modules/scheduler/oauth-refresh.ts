import { TenantRepository } from "../../lib/repositories/tenant-repository.js";
import { TrayClient } from "../../integrations/ecommerce/tray/client.js";
import { logger } from "../../utils/logger.js";

const repo = new TenantRepository({ fallbackToFiles: false });
const REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const RENEW_BEFORE_MS = 60 * 60 * 1000;

let interval: NodeJS.Timeout | null = null;

async function tick() {
  try {
    const expiring = await repo.listExpiringTokens("tray", RENEW_BEFORE_MS);
    if (expiring.length === 0) return;
    logger.info({ count: expiring.length }, "OAuth refresh: tokens expirando");
    for (const t of expiring) {
      await TrayClient.refresh(t.tenantId);
    }
  } catch (err: any) {
    logger.error({ err: err.message }, "OAuth refresh tick falhou");
  }
}

export function startOAuthRefreshWorker() {
  if (interval) return;
  logger.info(">>> [OAuth Refresh] Worker iniciado");
  tick();
  interval = setInterval(tick, REFRESH_INTERVAL_MS);
}

export function stopOAuthRefreshWorker() {
  if (interval) clearInterval(interval);
  interval = null;
}
