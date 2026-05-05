import { Router } from "express";
import { z } from "zod";
import { TenantRepository } from "../../../lib/repositories/tenant-repository.js";
import { invalidate as invalidateFlowRegistry } from "../../../modules/automation/engine/flow-registry.js";

const repo = new TenantRepository({ fallbackToFiles: false });
export const adminFlowsRouter = Router();

const FlowSchema = z.object({
  slug: z.string().regex(/^[a-z0-9_-]+$/),
  title: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  description: z.string().default(""),
  steps: z.array(z.any()).min(1),
  enabled: z.boolean().default(true),
});

adminFlowsRouter.get("/api/admin/tenants/:id/flows", async (req, res) => {
  const list = await repo.listFlows(req.params.id as string);
  res.json(list);
});

adminFlowsRouter.get("/api/admin/tenants/:id/flows/:slug", async (req, res): Promise<any> => {
  const list = await repo.listFlows(req.params.id as string);
  const found = list.find((f) => f.slug === req.params.slug);
  if (!found) return res.status(404).json({ error: "Flow not found" });
  res.json(found);
});

adminFlowsRouter.post("/api/admin/tenants/:id/flows", async (req, res): Promise<any> => {
  const tenantId = req.params.id as string;
  const parsed = FlowSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
  const saved = await repo.upsertFlow({ tenantId, ...parsed.data });
  invalidateFlowRegistry(tenantId);
  res.status(201).json(saved);
});

adminFlowsRouter.delete("/api/admin/tenants/:id/flows/:slug", async (req, res): Promise<any> => {
  const tenantId = req.params.id as string;
  await repo.deleteFlow(tenantId, req.params.slug as string);
  invalidateFlowRegistry(tenantId);
  res.status(204).send();
});
