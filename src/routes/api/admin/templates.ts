import { Router } from "express";
import { z } from "zod";
import { TenantRepository } from "../../../lib/repositories/tenant-repository.js";
import { TenantService } from "../../../services/tenantService.js";

const repo = new TenantRepository({ fallbackToFiles: false });
export const adminTemplatesRouter = Router();

const TemplateSchema = z.object({
  kind: z.enum(["text", "buttons"]),
  key: z.string().min(1),
  content: z.any(),
});

adminTemplatesRouter.get("/api/admin/tenants/:id/templates", async (req, res) => {
  const list = await repo.listTemplates(req.params.id as string);
  res.json(list);
});

adminTemplatesRouter.post("/api/admin/tenants/:id/templates", async (req, res): Promise<any> => {
  const tenantId = req.params.id as string;
  const parsed = TemplateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
  const saved = await repo.upsertTemplate({
    tenantId,
    kind: parsed.data.kind,
    key: parsed.data.key,
    content: parsed.data.content,
  });
  TenantService.invalidate(tenantId);
  res.status(201).json(saved);
});

adminTemplatesRouter.delete("/api/admin/tenants/:id/templates/:kind/:key", async (req, res): Promise<any> => {
  const tenantId = req.params.id as string;
  const kind = req.params.kind as string;
  const key = req.params.key as string;
  await repo.deleteTemplate(tenantId, kind, key);
  TenantService.invalidate(tenantId);
  res.status(204).send();
});
