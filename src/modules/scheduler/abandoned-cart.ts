import { TenantRepository } from "../../lib/repositories/tenant-repository.js";
import { TrayClient } from "../../integrations/ecommerce/tray/client.js";
import { TenantService } from "../../services/tenantService.js";
import { processEvent } from "../automation/service.js";
import { getRedis, isRedisReady } from "../../lib/redis.js";
import { logger } from "../../utils/logger.js";

const repo = new TenantRepository({ fallbackToFiles: false });

// Horários de execução em America/Sao_Paulo
const TARGET_HOURS_BRT = [8, 12, 18];
// Quanto tempo "atrás" considerar carrinhos como abandonados (24h)
const LOOKBACK_HOURS = 24;
// TTL no Redis pra não disparar múltiplas vezes pro mesmo carrinho (7 dias)
const SENT_TTL_SECONDS = 7 * 24 * 3600;

let interval: NodeJS.Timeout | null = null;
let lastTriggerKey: string | null = null;

function currentHourBRT(): number {
  // Brasília é UTC-3
  const utc = new Date();
  const brtMs = utc.getTime() - 3 * 60 * 60 * 1000;
  return new Date(brtMs).getUTCHours();
}

function todayKeyBRT(): string {
  const utc = new Date();
  const brtMs = utc.getTime() - 3 * 60 * 60 * 1000;
  return new Date(brtMs).toISOString().slice(0, 10);
}

async function alreadySentForCart(tenantId: string, cartId: string | number): Promise<boolean> {
  try {
    const ready = await isRedisReady();
    if (!ready) return false;
    const redis = getRedis();
    const key = `abandoned-cart:sent:${tenantId}:${cartId}`;
    const result = await redis.set(key, Date.now().toString(), "EX", SENT_TTL_SECONDS, "NX");
    // Se result for null → chave já existia → já foi disparado
    return result === null;
  } catch (err: any) {
    logger.warn({ err: err.message }, "alreadySentForCart Redis falhou — assumindo não enviado");
    return false;
  }
}

async function processCartsForTenant(tenantId: string): Promise<{ found: number; dispatched: number }> {
  let client: TrayClient;
  try {
    client = await TrayClient.forTenant(tenantId);
  } catch (err: any) {
    logger.warn({ err: err.message, tenantId }, "abandoned-cart: cliente Tray indisponível");
    return { found: 0, dispatched: 0 };
  }

  // Janela: últimas N horas
  const end = new Date();
  const start = new Date(end.getTime() - LOOKBACK_HOURS * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const carts = await client.listCarts({
    dateStart: fmt(start),
    dateEnd: fmt(end),
    hasCustomer: "1",
  });

  let dispatched = 0;
  for (const c of carts) {
    const cartId = c.id || c.cart_id;
    if (!cartId) continue;
    if (await alreadySentForCart(tenantId, cartId)) continue;

    const tenantConfig = await TenantService.getTenantConfig(tenantId);
    if (!tenantConfig) {
      logger.warn({ tenantId }, "abandoned-cart: tenantConfig não disponível");
      break;
    }

    // Monta evento sintético com scope_name="abandoned_cart" — TrayAdapter trata sem lookup
    const cellphone = c.customer?.cellphone || c.customer?.phone || c.cellphone || "";
    const customerName = c.customer?.name || c.customer_name || "";
    const cartUrl = c.url || c.cart_url || c.checkout_url || "";
    const products = Array.isArray(c.ProductsInCart)
      ? c.ProductsInCart.map((p: any) => p.name).filter(Boolean).join(", ")
      : (c.products || "");

    const rawEvent = {
      scope_name: "abandoned_cart",
      scope_id: cartId,
      act: "update",
      cellphone,
      customer_name: customerName,
      email: c.customer?.email || c.email || "",
      cart_url: cartUrl,
      products,
    };

    try {
      const adapter = tenantConfig.inputAdapter as any;
      const normalized = typeof adapter.normalizeEventAsync === "function"
        ? await adapter.normalizeEventAsync(rawEvent, tenantId)
        : adapter.normalizeEvent(rawEvent);
      if (!normalized) continue;

      await processEvent({
        flowAlias: normalized.flowAlias,
        context: normalized,
        tenantConfig,
        webhookReceivedAt: Date.now(),
        webhookPayload: rawEvent,
      });
      dispatched++;
    } catch (err: any) {
      logger.error({ err: err.message, tenantId, cartId }, "abandoned-cart: dispatch falhou");
    }
  }

  return { found: carts.length, dispatched };
}

async function tick() {
  const hourBRT = currentHourBRT();
  if (!TARGET_HOURS_BRT.includes(hourBRT)) return;

  const triggerKey = `${todayKeyBRT()}-${hourBRT}`;
  if (lastTriggerKey === triggerKey) return; // já rodou nesta hora hoje
  lastTriggerKey = triggerKey;

  logger.info({ hourBRT }, ">>> [Abandoned Cart] tick iniciado");

  // Busca todos os tenants Tray ativos
  let tenants: { id: string; adapterType: string }[];
  try {
    const all = await repo.list();
    tenants = all.filter(t => t.adapterType === "tray" && t.status === "active");
  } catch (err: any) {
    logger.error({ err: err.message }, "abandoned-cart: lista tenants falhou");
    return;
  }

  for (const t of tenants) {
    const r = await processCartsForTenant(t.id);
    logger.info({ tenantId: t.id, ...r }, "abandoned-cart: tenant processado");
  }
}

export function startAbandonedCartWorker() {
  if (interval) return;
  logger.info({ targetHoursBRT: TARGET_HOURS_BRT, lookbackHours: LOOKBACK_HOURS }, ">>> [Abandoned Cart] Worker iniciado");
  // Verifica a cada 30 minutos. tick() decide se executa baseado na hora.
  interval = setInterval(tick, 30 * 60 * 1000);
}

export function stopAbandonedCartWorker() {
  if (interval) clearInterval(interval);
  interval = null;
}
