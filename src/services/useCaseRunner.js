import { renderTemplate } from "../flow-engine/templateRenderer.js";
import { addTag, removeTag, sendButtonsPro, sendTextMessage } from "../clients/shotzapClient.js";
import { delay } from "../utils/delay.js";
import { logger } from "../utils/logger.js";

const hasAnyTag = (contextTags, tags) => {
  if (!Array.isArray(contextTags)) return false;
  const normalized = contextTags.map((tag) => tag.toLowerCase());
  return tags.some((tag) => normalized.includes(tag.toLowerCase()));
};

const buildTagPayload = (tag, context) => ({
  phone: context.number,
  tag
});

const buildTextPayload = (text, context) => ({
  openTicket: 0,
  body: [
    {
      phone: context.number,
      message: text
    }
  ]
});

const handleChoice = async (context, templates) => {
  const choice = (context.choice || "").toString().toLowerCase();

  if (choice.includes("descadastre")) {
    const payload = buildTextPayload(
      renderTemplate(templates.pedidoRecebidoDescadastre, context),
      context
    );
    await sendTextMessage(payload);
    return;
  }

  if (choice.includes("rastrear")) {
    const payload = buildTextPayload(
      renderTemplate(templates.pedidoRecebidoRastrear, context),
      context
    );
    await sendTextMessage(payload);
    return;
  }

  const payload = buildTextPayload(
    renderTemplate(templates.pedidoRecebidoSelecione, context),
    context
  );
  await sendTextMessage(payload);
};

export const runUseCase = async (useCase, context, templates) => {
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
        await addTag(buildTagPayload(step.tag, context));
        break;
      }
      case "removeTag": {
        logger.info({ tag: step.tag, label: step.label }, "Removendo tag");
        await removeTag(buildTagPayload(step.tag, context));
        break;
      }
      case "sendButtons": {
        logger.info({ label: step.label }, "Enviando botões");
        const payload = renderTemplate(step.template, context);
        await sendButtonsPro(payload);
        break;
      }
      case "sendText": {
        logger.info({ label: step.label }, "Enviando texto");
        const text = renderTemplate(step.text, context);
        const payload = buildTextPayload(text, context);
        await sendTextMessage(payload);
        break;
      }
      case "wait": {
        logger.info({ seconds: step.seconds, label: step.label }, "Aguardando");
        await delay(step.seconds * 1000);
        break;
      }
      case "conditionalChoice": {
        logger.info({ label: step.label }, "Tratando escolha do cliente");
        await handleChoice(context, templates);
        break;
      }
      default:
        logger.warn({ step }, "Tipo de passo não reconhecido");
    }
  }

  return { skipped: false };
};
