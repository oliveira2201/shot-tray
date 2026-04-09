import { renderTemplate } from "../../../flow-engine/templateRenderer.js";
import { AutomationContext, IChannelProvider, Step, UseCase } from "../../../types/automation.js";
import { delay } from "../../../utils/delay.js";
import { logger } from "../../../utils/logger.js";
import { SchedulerService } from "../../scheduler/service.js";
import { ExecutionTracker } from "../../execution/tracker.js";
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
  tracker?: ExecutionTracker;
}

export const runUseCase = async ({ useCase, context, provider, templates, tracker }: RunUseCaseParams) => {
  // Se tracker veio do service.ts (webhook), ele é o root.
  // Se não, cria um novo (execução standalone — scheduler, continuação, etc).
  const isRoot = !!tracker || !context._continuationOf;
  if (!tracker) {
    tracker = new ExecutionTracker({
      tenantId: context._tenantId || "unknown",
      flowId: useCase.id,
      flowAlias: useCase.aliases?.[0] || useCase.title || useCase.id,
      phone: context.number,
      customerName: context.name,
      trigger: context._trigger || "scheduler",
    });
  }

  const steps = useCase.steps;
  try {
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepStart = Date.now();

      switch (step.type) {
        case "stopIfHasAnyTag": {
          if (hasAnyTag(context.tags, step.tags)) {
            logger.info({ tags: step.tags, label: step.label }, "Fluxo encerrado por condição de tag");
            tracker.logStep({ type: step.type, label: step.label, status: "skipped", durationMs: Date.now() - stepStart, input: { tags: step.tags } });
            if (isRoot) await tracker.complete("completed");
            return { skipped: true };
          }
          tracker.logStep({ type: step.type, label: step.label, status: "ok", durationMs: Date.now() - stepStart, input: { tags: step.tags }, output: "passed" });
          break;
        }
        case "addTag": {
          logger.info({ tag: step.tag, label: step.label }, "Adicionando tag");
          try {
            await provider.addTag(buildTagPayload(step.tag, context));
            tracker.logStep({ type: step.type, label: step.label, status: "ok", durationMs: Date.now() - stepStart, input: { tag: step.tag } });
          } catch (err: any) {
            logger.warn({ tag: step.tag, error: err.message }, "Falha ao adicionar tag (não bloqueante)");
            tracker.logStep({ type: step.type, label: step.label, status: "error", durationMs: Date.now() - stepStart, input: { tag: step.tag }, error: err.message });
          }
          break;
        }
        case "removeTag": {
          logger.info({ tag: step.tag, label: step.label }, "Removendo tag");
          try {
            await provider.removeTag(buildTagPayload(step.tag, context));
            tracker.logStep({ type: step.type, label: step.label, status: "ok", durationMs: Date.now() - stepStart, input: { tag: step.tag } });
          } catch (err: any) {
            logger.warn({ tag: step.tag, error: err.message }, "Falha ao remover tag (não bloqueante)");
            tracker.logStep({ type: step.type, label: step.label, status: "error", durationMs: Date.now() - stepStart, input: { tag: step.tag }, error: err.message });
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
          tracker.logStep({ type: step.type, label: step.label, status: "ok", durationMs: Date.now() - stepStart, input: { tags: step.tags } });
          break;
        }
        case "sendButtons": {
          logger.info({ label: step.label }, "Enviando botões");
          const template = resolveTemplate(step.templateKey || step.template, templates);
          if (!template) {
            logger.error({ key: step.templateKey }, "Template de botões não encontrado");
            tracker.logStep({ type: step.type, label: step.label, status: "error", durationMs: Date.now() - stepStart, error: "Template não encontrado" });
            continue;
          }
          const rendered = renderTemplate(template, context);
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
          try {
            await provider.sendButtons(buttonsPayload);
            tracker.logStep({ type: step.type, label: step.label, status: "ok", durationMs: Date.now() - stepStart, input: { templateKey: step.templateKey || step.template } });
          } catch (err: any) {
            tracker.logStep({ type: step.type, label: step.label, status: "error", durationMs: Date.now() - stepStart, error: err.message });
            throw err;
          }
          break;
        }
        case "sendText": {
          logger.info({ label: step.label }, "Enviando texto");
          const template = resolveTemplate(step.textKey || step.text, templates);
          if (!template) {
            logger.error({ key: step.textKey }, "Template de texto não encontrado");
            tracker.logStep({ type: step.type, label: step.label, status: "error", durationMs: Date.now() - stepStart, error: "Template não encontrado" });
            continue;
          }
          const text = renderTemplate(template, context);
          const payload = buildTextPayload(text, context);
          try {
            await provider.sendText(payload);
            tracker.logStep({ type: step.type, label: step.label, status: "ok", durationMs: Date.now() - stepStart, input: { textKey: step.textKey || step.text } });
          } catch (err: any) {
            tracker.logStep({ type: step.type, label: step.label, status: "error", durationMs: Date.now() - stepStart, error: err.message });
            throw err;
          }
          break;
        }
        case "wait": {
          const waitSecs = step.seconds || 0;
          const remainingAfterWait = steps.slice(i + 1);

          if (waitSecs <= 5 || remainingAfterWait.length === 0) {
            logger.info({ seconds: waitSecs, label: step.label }, "Aguardando (inline)");
            if (waitSecs > 0) await delay(waitSecs * 1000);
            tracker.logStep({ type: step.type, label: step.label, status: "ok", durationMs: Date.now() - stepStart, input: { seconds: waitSecs, mode: "inline" } });
          } else {
            logger.info({ seconds: waitSecs, remainingSteps: remainingAfterWait.length, label: step.label }, "Aguardando (agendado)");
            await SchedulerService.scheduleContinuation(
              context._tenantId || "ebenezer",
              useCase.id,
              waitSecs,
              context,
              remainingAfterWait,
              []
            );
            tracker.logStep({ type: step.type, label: step.label, status: "ok", durationMs: Date.now() - stepStart, input: { seconds: waitSecs, mode: "scheduled", remainingSteps: remainingAfterWait.length } });
            if (isRoot) await tracker.defer();
            return { skipped: false, deferred: true };
          }
          break;
        }
        case "scheduleFlow": {
          const iteration = (context._iteration || 0) + 1;
          const maxIterations = step.maxIterations || 999;
          if (iteration > maxIterations) {
            logger.info({ iteration, max: maxIterations, label: step.label }, "Limite de iterações atingido, não agendando");
            tracker.logStep({ type: step.type, label: step.label, status: "skipped", durationMs: Date.now() - stepStart, input: { iteration, maxIterations } });
            break;
          }
          logger.info({ flow: step.targetFlow, delay: step.delaySeconds, iteration, label: step.label }, "Agendando próximo fluxo");
          await SchedulerService.scheduleFlow(
              "ebenezer",
              step.targetFlow,
              step.delaySeconds || 60,
              { ...context, _iteration: iteration }
          );
          tracker.logStep({ type: step.type, label: step.label, status: "ok", durationMs: Date.now() - stepStart, input: { targetFlow: step.targetFlow, delaySeconds: step.delaySeconds, iteration } });
          break;
        }
        case "cancelableWait": {
          const remainingSteps = steps.slice(i + 1);
          const cancelIfTags = step.cancelIfTags || [];
          // Turbo mode pra testes end-to-end: se FLOW_WAIT_TURBO estiver setado,
          // limita o wait ao valor dele (ex: FLOW_WAIT_TURBO=3 → max 3s por espera).
          const rawSecs = step.seconds || 60;
          const turbo = Number(process.env.FLOW_WAIT_TURBO);
          const delaySecs = Number.isFinite(turbo) && turbo > 0 ? Math.min(rawSecs, turbo) : rawSecs;

          if (remainingSteps.length === 0) {
            logger.info({ label: step.label }, "cancelableWait sem steps restantes — ignorando");
            tracker.logStep({ type: step.type, label: step.label, status: "skipped", durationMs: Date.now() - stepStart, output: "no remaining steps" });
            break;
          }

          if (cancelIfTags.length > 0 && context.number && provider.getContactTags) {
            const currentTags = await provider.getContactTags(context.number);
            if (hasAnyTag(currentTags, cancelIfTags)) {
              logger.info({ cancelIfTags, label: step.label }, "cancelableWait — já tem tag de cancelamento, encerrando flow");
              tracker.logStep({ type: step.type, label: step.label, status: "skipped", durationMs: Date.now() - stepStart, input: { cancelIfTags }, output: "cancelled by tag" });
              if (isRoot) await tracker.complete("completed");
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

          tracker.logStep({ type: step.type, label: step.label, status: "ok", durationMs: Date.now() - stepStart, input: { seconds: delaySecs, cancelIfTags, remainingSteps: remainingSteps.length } });
          if (isRoot) await tracker.defer();
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

          tracker.logStep({ type: step.type, label: step.label, status: "ok", durationMs: Date.now() - stepStart, input: { conditions: conditions.map((c: any) => c.match), timeoutMs } });

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
              const template = resolveTemplate(templateKey, templates);
              if (template) {
                const text = renderTemplate(template, context);
                const payload = buildTextPayload(text, context);
                await provider.sendText(payload);
              }

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

          if (isRoot) await tracker.defer();
          return { skipped: false, deferred: true };
        }
        default:
          logger.warn({ step }, "Tipo de passo não reconhecido");
          tracker.logStep({ type: step.type, label: step.label || "unknown", status: "skipped", durationMs: Date.now() - stepStart, output: "tipo não reconhecido" });
      }
    }

    if (isRoot) await tracker.complete();
    return { skipped: false };

  } catch (err: any) {
    if (isRoot) await tracker.fail(err.message);
    throw err;
  }
};
