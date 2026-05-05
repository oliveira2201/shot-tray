import { Router } from "express";
import { z } from "zod";
import { TenantRepository } from "../../../lib/repositories/tenant-repository.js";
import { TenantService } from "../../../services/tenantService.js";

const repo = new TenantRepository({ fallbackToFiles: false });
export const adminTenantsRouter = Router();

const TenantSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]+$/),
  name: z.string().min(1),
  status: z.enum(["active", "disabled"]).default("active"),
  adapterType: z.enum(["tray", "nuvemshop", "default"]),
  providerType: z.enum(["shotzap"]),
  adapterConfig: z.record(z.any()).default({}),
  providerConfig: z.object({
    baseUrl: z.string().url(),
    token: z.string().min(1),
    paths: z.record(z.string()).default({}),
    tagsCachePath: z.string().optional(),
  }),
});

adminTenantsRouter.get("/api/admin/tenants", async (_req, res) => {
  const list = await repo.list();
  res.json(list);
});

adminTenantsRouter.get("/api/admin/tenants/:id", async (req, res): Promise<any> => {
  const t = await repo.findById(req.params.id as string);
  if (!t) return res.status(404).json({ error: "Tenant not found" });
  res.json(t);
});

adminTenantsRouter.post("/api/admin/tenants", async (req, res): Promise<any> => {
  const parsed = TenantSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
  const saved = await repo.upsertTenant(parsed.data);
  TenantService.invalidate(saved.id);
  res.status(201).json(saved);
});

adminTenantsRouter.put("/api/admin/tenants/:id", async (req, res): Promise<any> => {
  const id = req.params.id as string;
  const parsed = TenantSchema.safeParse({ ...req.body, id });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
  const saved = await repo.upsertTenant(parsed.data);
  TenantService.invalidate(id);
  res.json(saved);
});

adminTenantsRouter.delete("/api/admin/tenants/:id", async (req, res): Promise<any> => {
  const id = req.params.id as string;
  await repo.setTenantStatus(id, "disabled");
  TenantService.invalidate(id);
  res.status(204).send();
});
