import { logger } from "../../../utils/logger.js";
import { getRedis, isRedisReady } from "../../../lib/redis.js";

export interface ConditionAction {
  type: "addTag" | "removeTag" | "stopFlow";
  tag?: string;
}

export interface ChoiceCondition {
  match: string;
  responseTemplate: string;
  actions?: ConditionAction[];
}

interface PendingChoiceData {
  tenantId: string;
  phone: string;
  conditions: ChoiceCondition[];
  defaultTemplate: string;
  remainingSteps: any[];
  context: any;
  flowId: string;
  createdAt: number;
  expiresAt: number;
}

interface PendingChoice extends PendingChoiceData {
  timer: NodeJS.Timeout;
}

const REDIS_PREFIX = "shot:choice:";
const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutos

// Map em memória para timers (timers não podem ir pro Redis)
const pendingChoices = new Map<string, PendingChoice>();

// Callbacks registrados por phone (necessário para onResolve)
const resolveCallbacks = new Map<string, (choice: string | null, templateKey: string, actions?: ConditionAction[]) => Promise<void>>();

/** Salva estado no Redis para sobreviver a restarts */
async function persistToRedis(phone: string, data: PendingChoiceData) {
  try {
    const ready = await isRedisReady();
    if (!ready) return;
    const redis = getRedis();
    const ttl = Math.ceil((data.expiresAt - Date.now()) / 1000);
    if (ttl <= 0) return;
    await redis.set(`${REDIS_PREFIX}${phone}`, JSON.stringify(data), "EX", ttl);
  } catch (err: any) {
    logger.warn({ phone, err: err.message }, "Falha ao persistir choice no Redis");
  }
}

/** Remove do Redis */
async function removeFromRedis(phone: string) {
  try {
    const ready = await isRedisReady();
    if (!ready) return;
    const redis = getRedis();
    await redis.del(`${REDIS_PREFIX}${phone}`);
  } catch {}
}

/** Busca do Redis (usado no handleIncomingMessage como fallback) */
async function getFromRedis(phone: string): Promise<PendingChoiceData | null> {
  try {
    const ready = await isRedisReady();
    if (!ready) return null;
    const redis = getRedis();
    const raw = await redis.get(`${REDIS_PREFIX}${phone}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Restaura listeners do Redis após restart do server.
 * Chamado uma vez na inicialização.
 */
export async function restoreChoicesFromRedis() {
  try {
    const ready = await isRedisReady();
    if (!ready) return;
    const redis = getRedis();
    const keys = await redis.keys(`${REDIS_PREFIX}*`);
    if (keys.length === 0) return;

    let restored = 0;
    for (const key of keys) {
      const raw = await redis.get(key);
      if (!raw) continue;
      const data: PendingChoiceData = JSON.parse(raw);
      const now = Date.now();

      if (data.expiresAt <= now) {
        // Expirado — limpar
        await redis.del(key);
        continue;
      }

      // Recriar timer com tempo restante
      const remainingMs = data.expiresAt - now;
      const timer = setTimeout(async () => {
        pendingChoices.delete(data.phone);
        await removeFromRedis(data.phone);
        logger.info({ phone: data.phone, flowId: data.flowId }, "conditionalChoice timeout (restaurado do Redis)");
        // Sem callback — o onResolve de timeout será tratado pelo scheduler/flow engine
      }, remainingMs);

      pendingChoices.set(data.phone, { ...data, timer });
      restored++;
    }

    if (restored > 0) {
      logger.info({ restored }, "Choice listeners restaurados do Redis");
    }
  } catch (err: any) {
    logger.warn({ err: err.message }, "Falha ao restaurar choices do Redis");
  }
}

/**
 * Registra que um contato está esperando uma resposta (conditionalChoice).
 * Se já existia um listener pro mesmo phone, cancela o anterior.
 */
export function registerChoice(opts: {
  tenantId: string;
  phone: string;
  flowId: string;
  conditions: ChoiceCondition[];
  defaultTemplate: string;
  remainingSteps: any[];
  context: any;
  timeoutMs?: number;
  onResolve: (choice: string | null, templateKey: string, actions?: ConditionAction[]) => Promise<void>;
}) {
  const { phone, tenantId, flowId, conditions, defaultTemplate, remainingSteps, context, timeoutMs } = opts;

  // Cancelar listener anterior se existir
  const existing = pendingChoices.get(phone);
  if (existing) {
    clearTimeout(existing.timer);
    logger.info({ phone }, "Choice listener anterior cancelado (substituído)");
  }

  const timeout = timeoutMs || DEFAULT_TIMEOUT_MS;
  const now = Date.now();
  const expiresAt = now + timeout;

  const timer = setTimeout(async () => {
    const pending = pendingChoices.get(phone);
    if (!pending) return;
    pendingChoices.delete(phone);
    resolveCallbacks.delete(phone);
    await removeFromRedis(phone);

    logger.info({ phone, defaultTemplate, flowId }, "conditionalChoice timeout — enviando default");
    try {
      await opts.onResolve(null, defaultTemplate);
    } catch (err: any) {
      logger.error({ phone, error: err.message }, "Erro ao resolver choice timeout");
    }
  }, timeout);

  const choiceData: PendingChoiceData = {
    tenantId, phone, flowId, conditions, defaultTemplate, remainingSteps, context,
    createdAt: now, expiresAt,
  };

  pendingChoices.set(phone, { ...choiceData, timer });
  resolveCallbacks.set(phone, opts.onResolve);

  // Persistir no Redis (async, não bloqueia)
  persistToRedis(phone, choiceData).catch(() => {});

  logger.info(
    { phone, flowId, conditions: conditions.map(c => c.match), timeout: `${timeout / 1000}s` },
    "Choice listener registrado"
  );
}

/**
 * Chamado quando uma mensagem é recebida de um contato.
 * Retorna true se havia um listener e foi processado.
 */
export async function handleIncomingMessage(opts: {
  phone: string;
  message: string;
  onResolve: (choice: string, templateKey: string, pending: {
    remainingSteps: any[];
    context: any;
    tenantId: string;
    flowId: string;
    actions?: ConditionAction[];
  }) => Promise<void>;
}): Promise<boolean> {
  const { phone, message } = opts;

  // Tentar memória primeiro, fallback pro Redis
  let pendingData: PendingChoiceData | null = null;
  const inMemory = pendingChoices.get(phone);

  if (inMemory) {
    clearTimeout(inMemory.timer);
    pendingChoices.delete(phone);
    resolveCallbacks.delete(phone);
    pendingData = inMemory;
  } else {
    // Fallback: buscar no Redis (ex: após restart)
    pendingData = await getFromRedis(phone);
  }

  if (!pendingData) return false;

  // Limpar do Redis
  await removeFromRedis(phone);

  const msgLower = message.toLowerCase();
  const matched = pendingData.conditions.find(c => msgLower.includes(c.match.toLowerCase()));

  const templateKey = matched ? matched.responseTemplate : pendingData.defaultTemplate;
  const choice = matched ? matched.match : null;
  const actions = matched?.actions;

  logger.info(
    { phone, message: msgLower, matched: choice, templateKey, actions, flowId: pendingData.flowId },
    "conditionalChoice — resposta recebida"
  );

  try {
    await opts.onResolve(choice || "default", templateKey, {
      remainingSteps: pendingData.remainingSteps,
      context: pendingData.context,
      tenantId: pendingData.tenantId,
      flowId: pendingData.flowId,
      actions,
    });
  } catch (err: any) {
    logger.error({ phone, error: err.message }, "Erro ao resolver choice");
  }

  return true;
}

/**
 * Verifica se um número tem um listener pendente.
 */
export function hasPendingChoice(phone: string): boolean {
  return pendingChoices.has(phone);
}

/**
 * Retorna stats dos listeners ativos.
 */
export function getStats() {
  return {
    active: pendingChoices.size,
    listeners: Array.from(pendingChoices.entries()).map(([phone, p]) => ({
      phone,
      flowId: p.flowId,
      conditions: p.conditions.map(c => c.match),
      ageMs: Date.now() - p.createdAt,
    })),
  };
}
