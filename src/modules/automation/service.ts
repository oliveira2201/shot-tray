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
        number: context.customer.phone,
        name: context.customer.name,
        tags: context.customer.tags,
        _tenantId: tenantConfig.id,
        ...context.data
    },
    provider,
    templates,
    tracker,
  });
};
