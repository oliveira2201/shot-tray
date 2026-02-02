import { Router } from "express";
import crypto from "crypto";
import { env } from "../config/env.js";
import { sendFromFlow } from "../services/messageDispatcher.js";
import { mapErpEventToFlow } from "../services/erpEventMapper.js";
import { logger } from "../utils/logger.js";
import { shotzapUseCases } from "../use-cases/index.js";

export const webhooksRouter = Router();

const verifySignature = (req) => {
  const signature = req.headers["x-erp-signature"];
  if (!signature) return false;

  const expected = crypto
    .createHmac("sha256", env.ERP_WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
};

webhooksRouter.post("/webhooks/erp/:provider", async (req, res) => {
  if (!verifySignature(req)) {
    return res.status(401).json({ error: "Assinatura inválida" });
  }

  const event = req.body;
  const flowName = mapErpEventToFlow(event);

  if (!flowName) {
    return res.status(400).json({ error: "Evento não mapeado" });
  }

  const context = {
    name: event?.customer?.name || event?.name,
    number: event?.customer?.phone || event?.phone,
    extra1: event?.order?.trackingUrl || event?.trackingUrl,
    extra2: event?.order?.invoiceUrl || event?.invoiceUrl,
    extra3: event?.order?.itemsSummary || event?.itemsSummary,
    escolha: event?.choice,
    choice: event?.choice,
    tags: event?.tags || event?.customer?.tags || []
  };

  try {
    const responses = await sendFromFlow({ flowName, context });
    res.json({ ok: true, flowName, responses });
  } catch (error) {
    logger.error({ error }, "Erro ao enviar mensagem via Shotzap");
    res.status(500).json({ error: "Falha ao enviar mensagem" });
  }
});

webhooksRouter.get("/flows", async (_req, res) => {
  const summary = shotzapUseCases.map((useCase) => ({
    id: useCase.id,
    title: useCase.title,
    aliases: useCase.aliases,
    description: useCase.description,
    steps: useCase.steps.length
  }));

  res.json({ flows: summary });
});
