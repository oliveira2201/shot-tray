import { logger } from "../utils/logger.js";
import { findUseCaseByName } from "../use-cases/index.js";
import { textTemplates } from "../use-cases/templates/index.js";
import { runUseCase } from "./useCaseRunner.js";

const normalizeFlowName = (flowFile) =>
  flowFile
    .replace(/\.[^.]+$/, "")
    .replace(/^\s+|\s+$/g, "")
    .toLowerCase();

export const sendFromFlow = async ({ flowName, context }) => {
  const useCase = findUseCaseByName(flowName);

  if (!useCase) {
    throw new Error(`Flow não encontrado: ${flowName}`);
  }

  logger.info({ flowName: useCase.id, title: useCase.title }, "Executando caso de uso Shotzap");
  return runUseCase(useCase, context, textTemplates);
};
