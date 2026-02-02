import { Router, Request, Response } from "express";
import { TenantService } from "../services/tenantService.js";
import { processEvent } from "../modules/automation/service.js";
import { logger } from "../utils/logger.js";

export const webhooksRouter = Router();

// Endpoint: /webhooks/:tenantId
// Ex: /webhooks/ebenezer
webhooksRouter.post("/webhooks/:tenantId", async (req: Request, res: Response): Promise<any> => {
  const { tenantId } = req.params as { tenantId: string };

  try {
    // 1. Load Tenant Configuration (Adapter + Provider)
    const tenantConfig = await TenantService.getTenantConfig(tenantId);
    
    if (!tenantConfig) {
      return res.status(404).json({ error: "Tenant not found" });
    }

    const { inputAdapter } = tenantConfig;

    // 2. Validate Signature (Security)
    if (process.env.ERP_WEBHOOK_SECRET && !inputAdapter.isSignatureValid(req, process.env.ERP_WEBHOOK_SECRET)) {
       logger.warn({ tenantId }, "Assinatura inválida (ignorado por enquanto)");
       // return res.status(401).json({ error: "Invalid signature" });
    }

    // 3. Normalize Event (Adapter Pattern)
    const normalizedEvent = inputAdapter.normalizeEvent(req.body);

    if (!normalizedEvent) {
      return res.status(200).json({ ignored: true, reason: "Event not mapped or relevant" });
    }

    // 4. Send to Automation Module (Black Box)
    const result = await processEvent({
      flowAlias: normalizedEvent.flowAlias,
      context: normalizedEvent,
      tenantConfig
    });

    res.json({ ok: true, flow: normalizedEvent.flowAlias, result });

  } catch (error: any) {
    logger.error({ error, tenantId }, "Webhook processing failed");
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});
