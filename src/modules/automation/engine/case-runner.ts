import { renderTemplate } from "../../../flow-engine/templateRenderer.js";
import { AutomationContext, IChannelProvider, Step, UseCase } from "../../../types/automation.js";
import { delay } from "../../../utils/delay.js";
import { logger } from "../../../utils/logger.js";
import { SchedulerService } from "../../scheduler/service.js";
import { registerChoice } from "./choice-listener.js";

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
  openTicket: "0",
  number: context.number,
  body: text
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
  const steps = useCase.steps;
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
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
        try {
          await provider.addTag(buildTagPayload(step.tag, context));
        } catch (err: any) {
          logger.warn({ tag: step.tag, error: err.message }, "Falha ao adicionar tag (não bloqueante)");
        }
        break;
      }
      case "removeTag": {
        logger.info({ tag: step.tag, label: step.label }, "Removendo tag");
        try {
          await provider.removeTag(buildTagPayload(step.tag, context));
        } catch (err: any) {
          logger.warn({ tag: step.tag, error: err.message }, "Falha ao remover tag (não bloqueante)");
        }
        break;
      }
      case "removeTags": {
        logger.info({ tags: step.tags, label: step.label }, "Removendo múltiplas tags");
        if (Array.isArray(step.tags)) {
          for (const tag of step.tags) {
            try {
              await provider.removeTag(buildTagPayload(tag, context));
            } catch (err: any) {
              logger.warn({ tag, error: err.message }, "Falha ao remover tag na lista (não bloqueante)");
            }
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
        const rendered = renderTemplate(template, context);
        // Wrapping no formato esperado pela API PRO: { openTicket, body: [{ phone, title, body, footer, buttons }] }
        const buttonsPayload = {
          openTicket: 0,
          body: [{
            phone: context.number,
            title: rendered.title || "",
            body: rendered.body || "",
            footer: rendered.footer || "",
            buttons: rendered.buttons || [],
          }]
        };
        await provider.sendButtons(buttonsPayload);
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
      case "scheduleFlow": {
        const iteration = (context._iteration || 0) + 1;
        const maxIterations = step.maxIterations || 999;
        if (iteration > maxIterations) {
          logger.info({ iteration, max: maxIterations, label: step.label }, "Limite de iterações atingido, não agendando");
          break;
        }
        logger.info({ flow: step.targetFlow, delay: step.delaySeconds, iteration, label: step.label }, "Agendando próximo fluxo");
        await SchedulerService.scheduleFlow(
            "ebenezer",
            step.targetFlow,
            step.delaySeconds || 60,
            { ...context, _iteration: iteration }
        );
        break;
      }
      case "cancelableWait": {
        // Agenda os steps restantes no scheduler com verificação de tags
        const remainingSteps = steps.slice(i + 1);
        const cancelIfTags = step.cancelIfTags || [];
        const delaySecs = step.seconds || 60;

        if (remainingSteps.length === 0) {
          logger.info({ label: step.label }, "cancelableWait sem steps restantes — ignorando");
          break;
        }

        // Antes de agendar, verifica se já deveria cancelar (evita agendar job inútil)
        if (cancelIfTags.length > 0 && context.number && provider.getContactTags) {
          const currentTags = await provider.getContactTags(context.number);
          if (hasAnyTag(currentTags, cancelIfTags)) {
            logger.info({ cancelIfTags, label: step.label }, "cancelableWait — já tem tag de cancelamento, encerrando flow");
            return { skipped: true };
          }
        }

        logger.info(
          { seconds: delaySecs, cancelIfTags, remainingSteps: remainingSteps.length, label: step.label },
          "cancelableWait — agendando continuação"
        );

        await SchedulerService.scheduleContinuation(
          context._tenantId || "ebenezer",
          useCase.id,
          delaySecs,
          context,
          remainingSteps,
          cancelIfTags
        );

        // Para a execução aqui — o scheduler retoma depois
        return { skipped: false, deferred: true };
      }
      case "conditionalChoice": {
        const remainingSteps = steps.slice(i + 1);
        const conditions = step.conditions || [];
        const defaultTemplate = step.defaultTemplate || "";
        const timeoutMs = (step.timeoutSeconds || 120) * 1000;

        logger.info(
          { label: step.label, conditions: conditions.map((c: any) => c.match), timeout: `${timeoutMs / 1000}s` },
          "Registrando listener de escolha do cliente"
        );

        registerChoice({
          tenantId: context._tenantId || "ebenezer",
          phone: context.number || "",
          flowId: useCase.id,
          conditions,
          defaultTemplate,
          remainingSteps,
          context,
          timeoutMs,
          onResolve: async (_choice: string | null, templateKey: string) => {
            // Enviar template de resposta
            const template = resolveTemplate(templateKey, templates);
            if (template) {
              const text = renderTemplate(template, context);
              const payload = buildTextPayload(text, context);
              await provider.sendText(payload);
            }

            // Continuar flow com os steps restantes
            if (remainingSteps.length > 0) {
              const continuationUseCase: UseCase = {
                id: useCase.id + "_choice_cont",
                title: useCase.title,
                aliases: [],
                description: "Continuação após conditionalChoice",
                steps: remainingSteps
              };
              await runUseCase({ useCase: continuationUseCase, context, provider, templates });
            }
          },
        });

        // Pausa o flow aqui — o listener retoma quando cliente responder ou timeout
        return { skipped: false, deferred: true };
      }
      default:
        logger.warn({ step }, "Tipo de passo não reconhecido");
    }
  }

  return { skipped: false };
};
