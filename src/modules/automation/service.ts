import { TenantConfig } from "../../types/automation.js";
import { NormalizedEvent } from "../../types/integration.js";
import { logger } from "../../utils/logger.js";
import { runUseCase } from "./engine/case-runner.js";
import { findFlowByAlias } from "./engine/flow-registry.js";

interface ProcessEventParams {
  flowAlias: string;
  context: NormalizedEvent;
  tenantConfig: TenantConfig;
}

// This service is the "Black Box" interface for the Automation Module
export const processEvent = async ({ flowAlias, context, tenantConfig }: ProcessEventParams) => {
  const useCase = await findFlowByAlias(tenantConfig.id, flowAlias);

  if (!useCase) {
    throw new Error(`Fluxo não encontrado para o alias: ${flowAlias}`);
  }

  const { provider, templates } = tenantConfig;

  logger.info({ flow: useCase.id, title: useCase.title }, "Iniciando automação");
  
  return runUseCase({
    useCase,
    context: {
        number: context.customer.phone,
        name: context.customer.name,
        tags: context.customer.tags,
        ...context.data // extra1, choice, etc
    },
    provider,
    templates
  });
};
