import { TenantConfig } from "../../types/automation.js";
import { NormalizedEvent } from "../../types/integration.js";
import { logger } from "../../utils/logger.js";
import { ExecutionTracker } from "../execution/tracker.js";
import { runUseCase } from "./engine/case-runner.js";
import { findFlowByAlias } from "./engine/flow-registry.js";

interface ProcessEventParams {
  flowAlias: string;
  context: NormalizedEvent;
  tenantConfig: TenantConfig;
  /** Timestamp de quando o webhook chegou */
  webhookReceivedAt?: number;
  /** Payload bruto do webhook */
  webhookPayload?: any;
}

// This service is the "Black Box" interface for the Automation Module
export const processEvent = async ({ flowAlias, context, tenantConfig, webhookReceivedAt, webhookPayload }: ProcessEventParams) => {
  const useCase = await findFlowByAlias(tenantConfig.id, flowAlias);

  if (!useCase) {
    throw new Error(`Fluxo não encontrado para o alias: ${flowAlias}`);
  }

  const { provider, templates } = tenantConfig;

  logger.info({ flow: useCase.id, title: useCase.title }, "Iniciando automação");

  // Buscar tags atuais do contato no ShotZap pra o stopIfHasAnyTag funcionar
  // logo no início do flow (sem wait). Fallback: lista vazia se a API falhar.
  let currentTags: string[] = context.customer.tags || [];
  if (context.customer.phone && provider.getContactTags) {
    try {
      const fetched = await provider.getContactTags(context.customer.phone);
      if (Array.isArray(fetched)) currentTags = fetched;
    } catch (err: any) {
      logger.warn({ error: err.message }, "Falha ao buscar tags do contato — usando vazio");
    }
  }

  // Criar tracker desde o webhook
  const tracker = new ExecutionTracker({
    tenantId: tenantConfig.id,
    flowId: useCase.id,
    flowAlias: useCase.aliases?.[0] || useCase.title || flowAlias,
    phone: context.customer.phone,
    customerName: context.customer.name,
    trigger: "webhook",
    webhookPayload,
    webhookReceivedAt,
  });

  return runUseCase({
    useCase,
    context: {
        // Vars globais do tenant (ex: link_loja) — prioridade mais baixa,
        // pra não sobrescrever name/number/extras do evento.
        ...(tenantConfig.vars || {}),
        number: context.customer.phone,
        name: context.customer.name,
        tags: currentTags,
        _tenantId: tenantConfig.id,
        ...context.data
    },
    provider,
    templates,
    tracker,
  });
};
