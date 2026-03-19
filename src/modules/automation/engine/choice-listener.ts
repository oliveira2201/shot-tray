import { logger } from "../../../utils/logger.js";

export interface ConditionAction {
  type: "addTag" | "removeTag" | "stopFlow";
  tag?: string;
}

export interface ChoiceCondition {
  match: string;
  responseTemplate: string;
  actions?: ConditionAction[];
}

interface PendingChoice {
  tenantId: string;
  phone: string;
  conditions: ChoiceCondition[];
  defaultTemplate: string;
  /** Steps restantes do flow após o conditionalChoice */
  remainingSteps: any[];
  /** Contexto da automação (number, name, etc) */
  context: any;
  /** Flow ID de origem */
  flowId: string;
  /** Timeout handle */
  timer: NodeJS.Timeout;
  /** Timestamp de criação */
  createdAt: number;
}

// Map de phone → PendingChoice
const pendingChoices = new Map<string, PendingChoice>();

const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutos

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

  const timer = setTimeout(async () => {
    // Timeout — ninguém respondeu, enviar defaultTemplate
    const pending = pendingChoices.get(phone);
    if (!pending) return;
    pendingChoices.delete(phone);

    logger.info({ phone, defaultTemplate, flowId }, "conditionalChoice timeout — enviando default");
    try {
      await opts.onResolve(null, defaultTemplate);
    } catch (err: any) {
      logger.error({ phone, error: err.message }, "Erro ao resolver choice timeout");
    }
  }, timeout);

  pendingChoices.set(phone, {
    tenantId,
    phone,
    flowId,
    conditions,
    defaultTemplate,
    remainingSteps,
    context,
    timer,
    createdAt: Date.now(),
  });

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

  const pending = pendingChoices.get(phone);
  if (!pending) return false;

  // Limpar o timer e remover do map
  clearTimeout(pending.timer);
  pendingChoices.delete(phone);

  const msgLower = message.toLowerCase();
  const matched = pending.conditions.find(c => msgLower.includes(c.match.toLowerCase()));

  const templateKey = matched ? matched.responseTemplate : pending.defaultTemplate;
  const choice = matched ? matched.match : null;
  const actions = matched?.actions;

  logger.info(
    { phone, message: msgLower, matched: choice, templateKey, actions, flowId: pending.flowId },
    "conditionalChoice — resposta recebida"
  );

  try {
    await opts.onResolve(choice || "default", templateKey, {
      remainingSteps: pending.remainingSteps,
      context: pending.context,
      tenantId: pending.tenantId,
      flowId: pending.flowId,
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
