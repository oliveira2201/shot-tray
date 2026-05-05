import { Router } from "express";
import { z } from "zod";
import { TenantRepository } from "../../../lib/repositories/tenant-repository.js";
import { TrayClient } from "../../../integrations/ecommerce/tray/client.js";

const repo = new TenantRepository({ fallbackToFiles: false });
export const adminOAuthRouter = Router();

const TrayCompleteSchema = z.object({
  apiAddress: z.string().url(),
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  expiresIn: z.number().int().positive(),
  scope: z.string().optional(),
});

adminOAuthRouter.get("/api/admin/tenants/:id/oauth/tray/status", async (req, res): Promise<any> => {
  const tenantId = req.params.id as string;
  const t = await repo.findOAuthToken(tenantId, "tray");
  if (!t) return res.json({ connected: false });
  res.json({
    connected: true,
    expiresAt: t.expiresAt,
    lastRefreshAt: t.lastRefreshAt,
    refreshFailures: t.refreshFailures,
    scope: t.scope,
  });
});

adminOAuthRouter.post("/api/admin/tenants/:id/oauth/tray/complete", async (req, res): Promise<any> => {
  const tenantId = req.params.id as string;
  const parsed = TrayCompleteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
  const tenant = await repo.findById(tenantId);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });
  const newAdapterConfig = { ...(tenant.adapterConfig as any), apiAddress: parsed.data.apiAddress };
  await repo.upsertTenant({ ...tenant, adapterConfig: newAdapterConfig });
  const expiresAt = new Date(Date.now() + parsed.data.expiresIn * 1000);
  await repo.upsertOAuthToken({
    tenantId,
    provider: "tray",
    accessToken: parsed.data.accessToken,
    refreshToken: parsed.data.refreshToken || null,
    expiresAt,
    scope: parsed.data.scope || null,
  });
  res.status(201).json({ connected: true, expiresAt });
});

adminOAuthRouter.post("/api/admin/tenants/:id/oauth/tray/refresh-now", async (req, res): Promise<any> => {
  const tenantId = req.params.id as string;
  const ok = await TrayClient.refresh(tenantId);
  if (!ok) return res.status(400).json({ refreshed: false });
  res.json({ refreshed: true });
});
