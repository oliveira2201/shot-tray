import { Router, Request, Response } from "express";
import { TenantService } from "../services/tenantService.js";
import { processEvent } from "../modules/automation/service.js";
import { handleIncomingMessage } from "../modules/automation/engine/choice-listener.js";
import { renderTemplate } from "../flow-engine/templateRenderer.js";
import { logger } from "../utils/logger.js";

export const webhooksRouter = Router();

// Endpoint: /webhooks/:tenantId
// Ex: /webhooks/ebenezer
webhooksRouter.post("/webhooks/:tenantId", async (req: Request, res: Response): Promise<any> => {
  const { tenantId } = req.params as { tenantId: string };

  try {
    // 1. Load Tenant Configuration
    const tenantConfig = await TenantService.getTenantConfig(tenantId);

    if (!tenantConfig) {
      logger.warn({ tenantId }, "❌ Tenant não encontrado");
      return res.status(404).json({ error: "Tenant not found" });
    }

    const { inputAdapter } = tenantConfig;
    logger.info({
      tenantId,
      adapter: tenantConfig.adapterName || 'unknown',
      bodyKeys: Object.keys(req.body),
      taginternals: req.body.taginternals,
      status: req.body.status,
      event: req.body.event,
    }, "📥 Webhook recebido");

    // 2. Validate Signature
    if (process.env.ERP_WEBHOOK_SECRET && !inputAdapter.isSignatureValid(req, process.env.ERP_WEBHOOK_SECRET)) {
       logger.warn({ tenantId }, "⚠️ Assinatura inválida (ignorado por enquanto)");
    }

    // 3. Normalize Event
    const normalizedEvent = inputAdapter.normalizeEvent(req.body);

    if (!normalizedEvent) {
      logger.info({ tenantId, body: JSON.stringify(req.body).substring(0, 200) }, "⏭️ Evento não mapeado, ignorado");
      return res.status(200).json({ ignored: true, reason: "Event not mapped or relevant" });
    }

    logger.info({
      tenantId,
      flowAlias: normalizedEvent.flowAlias,
      customerName: normalizedEvent.customer?.name,
      customerPhone: normalizedEvent.customer?.phone,
    }, "🔀 Evento normalizado → roteando para flow");

    // 4. Responder imediatamente e processar em background
    res.json({ ok: true, flow: normalizedEvent.flowAlias, status: "processing" });

    // 5. Executar flow em background (não bloqueia a resposta)
    processEvent({
      flowAlias: normalizedEvent.flowAlias,
      context: normalizedEvent,
      tenantConfig
    }).then((result) => {
      logger.info({ tenantId, flowAlias: normalizedEvent.flowAlias, result }, "✅ Flow executado");
    }).catch((err) => {
      logger.error({ tenantId, flowAlias: normalizedEvent.flowAlias, error: err.message }, "❌ Erro no flow");
    });

  } catch (error: any) {
    logger.error({ error, tenantId }, "Webhook processing failed");
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

/**
 * Webhook de mensagem recebida (resposta do cliente).
 * A Shotzap chama esse endpoint quando o cliente envia uma mensagem.
 * Formato esperado: { phone: "5586...", message: "texto da resposta" }
 * Ou formato Whaticket: { ticket: { contact: { number } }, body: "texto" }
 */
webhooksRouter.post("/webhooks/:tenantId/reply", async (req: Request, res: Response): Promise<any> => {
  const { tenantId } = req.params as { tenantId: string };

  try {
    // Extrair phone e message do payload (suporta múltiplos formatos)
    let phone: string;
    let message: string;

    if (req.body.phone && req.body.message) {
      // Formato simples
      phone = req.body.phone;
      message = req.body.message;
    } else if (req.body.ticket?.contact?.number && req.body.body) {
      // Formato Whaticket
      phone = req.body.ticket.contact.number;
      message = req.body.body;
    } else if (req.body.data?.ticket?.contact?.number && req.body.data?.body) {
      // Formato Whaticket v2
      phone = req.body.data.ticket.contact.number;
      message = req.body.data.body;
    } else {
      return res.status(200).json({ ignored: true, reason: "Formato não reconhecido" });
    }

    logger.info({ tenantId, phone, message: message.substring(0, 50) }, "Mensagem recebida do cliente");

    const tenantConfig = await TenantService.getTenantConfig(tenantId);
    if (!tenantConfig) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    const handled = await handleIncomingMessage({
      phone,
      message,
      onResolve: async (choice, templateKey, pending) => {
        // Enviar template de resposta
        const template = templateKey
          ? (tenantConfig.templates.text?.[templateKey] || tenantConfig.templates.buttons?.[templateKey] || tenantConfig.templates[templateKey])
          : null;

        if (template) {
          const text = renderTemplate(template, pending.context);
          await tenantConfig.provider.sendText({
            openTicket: "0",
            number: phone,
            body: typeof text === "string" ? text : text.body || text,
            queueId: "0",
          });
        }

        // Executar actions da condição (addTag, removeTag, stopFlow)
        let shouldStop = false;
        if (pending.actions && pending.actions.length > 0) {
          for (const action of pending.actions) {
            if (action.type === "addTag" && action.tag) {
              try {
                await tenantConfig.provider.addTag({ phone, tag: action.tag });
              } catch (err: any) {
                logger.warn({ tag: action.tag, error: err.message }, "Erro ao adicionar tag na action");
              }
            } else if (action.type === "removeTag" && action.tag) {
              try {
                await tenantConfig.provider.removeTag({ phone, tag: action.tag });
              } catch (err: any) {
                logger.warn({ tag: action.tag, error: err.message }, "Erro ao remover tag na action");
              }
            } else if (action.type === "stopFlow") {
              shouldStop = true;
            }
          }
        }

        // Se stopFlow, não continuar
        if (shouldStop) {
          logger.info({ phone, flowId: pending.flowId }, "Flow parado por action stopFlow");
          return;
        }

        // Continuar flow com steps restantes
        if (pending.remainingSteps.length > 0) {
          const { runUseCase } = await import("../modules/automation/engine/case-runner.js");
          await runUseCase({
            useCase: {
              id: pending.flowId + "_choice_cont",
              title: pending.flowId,
              aliases: [],
              description: "Continuação após resposta do cliente",
              steps: pending.remainingSteps,
            },
            context: pending.context,
            provider: tenantConfig.provider,
            templates: tenantConfig.templates,
          });
        }
      },
    });

    if (handled) {
      res.json({ ok: true, handled: true });
    } else {
      res.json({ ok: true, handled: false, reason: "Sem listener ativo para este número" });
    }
  } catch (error: any) {
    logger.error({ error, tenantId }, "Erro ao processar resposta do cliente");
    res.status(500).json({ error: error.message });
  }
});
