import { renderTemplate } from "../../../flow-engine/templateRenderer.js";
import { AutomationContext, IChannelProvider, Step, UseCase } from "../../../types/automation.js";
import { delay } from "../../../utils/delay.js";
import { logger } from "../../../utils/logger.js";

const hasAnyTag = (contextTags: string[] | undefined, tags: string[]) => {
  if (!Array.isArray(contextTags)) return false;
  const normalized = contextTags.map((tag) => tag.toLowerCase());
  return tags.some((tag) => normalized.includes(tag.toLowerCase()));
};

const buildTagPayload = (tag: string, context: AutomationContext) => ({
  phone: context.number,
  tag
});

const buildTextPayload = (text: string, context: AutomationContext) => ({
  openTicket: 0,
  body: [
    {
      phone: context.number,
      message: text
    }
  ]
});

const resolveTemplate = (keyOrObject: any, templates: Record<string, any>) => {
  if (typeof keyOrObject === "string" && templates[keyOrObject]) {
    return templates[keyOrObject];
  }
  return keyOrObject;
};

const handleChoice = async (context: AutomationContext, step: Step, provider: IChannelProvider, templates: Record<string, any>) => {
  const choice = (context.choice || "").toString().toLowerCase();

  const condition = step.conditions?.find((c: any) => choice.includes(c.match));
  // Condition response could be a key or object
  const rawTemplate = condition ? condition.responseTemplate : step.defaultTemplate;
  const template = resolveTemplate(rawTemplate, templates);

  if (template) {
    const payload = buildTextPayload(
      renderTemplate(template, context),
      context
    );
    await provider.sendText(payload);
  } else {
    logger.warn({ choice }, "Nenhuma ação definida para a escolha");
  }
};

interface RunUseCaseParams {
  useCase: UseCase;
  context: AutomationContext;
  provider: IChannelProvider;
  templates: Record<string, any>;
}

export const runUseCase = async ({ useCase, context, provider, templates }: RunUseCaseParams) => {
  for (const step of useCase.steps) {
    switch (step.type) {
      case "stopIfHasAnyTag": {
        if (hasAnyTag(context.tags, step.tags)) {
          logger.info({ tags: step.tags, label: step.label }, "Fluxo encerrado por condição de tag");
          return { skipped: true };
        }
        break;
      }
      case "addTag": {
        logger.info({ tag: step.tag, label: step.label }, "Adicionando tag");
        await provider.addTag(buildTagPayload(step.tag, context));
        break;
      }
      case "removeTag": {
        logger.info({ tag: step.tag, label: step.label }, "Removendo tag");
        await provider.removeTag(buildTagPayload(step.tag, context));
        break;
      }
      case "removeTags": {
        logger.info({ tags: step.tags, label: step.label }, "Removendo múltiplas tags");
        if (Array.isArray(step.tags)) {
          for (const tag of step.tags) {
            await provider.removeTag(buildTagPayload(tag, context));
          }
        }
        break;
      }
      case "sendButtons": {
        logger.info({ label: step.label }, "Enviando botões");
        const template = resolveTemplate(step.templateKey || step.template, templates);
        if (!template) {
           logger.error({ key: step.templateKey }, "Template de botões não encontrado");
           continue; 
        }
        const payload = renderTemplate(template, context);
        await provider.sendButtons(payload);
        break;
      }
      case "sendText": {
        logger.info({ label: step.label }, "Enviando texto");
        const template = resolveTemplate(step.textKey || step.text, templates);
         if (!template) {
           logger.error({ key: step.textKey }, "Template de texto não encontrado");
           continue; 
        }
        const text = renderTemplate(template, context);
        const payload = buildTextPayload(text, context);
        await provider.sendText(payload);
        break;
      }
      case "wait": {
        logger.info({ seconds: step.seconds, label: step.label }, "Aguardando");
        await delay(step.seconds * 1000);
        break;
      }
      case "conditionalChoice": {
        logger.info({ label: step.label }, "Tratando escolha do cliente");
        await handleChoice(context, step, provider, templates);
        break;
      }
      default:
        logger.warn({ step }, "Tipo de passo não reconhecido");
    }
  }

  return { skipped: false };
};
