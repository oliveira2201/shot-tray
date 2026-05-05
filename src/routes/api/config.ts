import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { logger } from "../../utils/logger.js";

export const configApiRouter = Router();

const configPath = () => path.join(process.cwd(), "src", "config", "tenants.json");

// GET /api/admin/config/:tenantId — retorna config do tenant
configApiRouter.get("/api/admin/config/:tenantId", async (req, res) => {
  try {
    const content = await fs.readFile(configPath(), "utf-8");
    const tenants = JSON.parse(content);
    const tenant = tenants.find((t: any) => t.id === req.params.tenantId);
    if (!tenant) return res.status(404).json({ error: "Tenant não encontrado" });
    res.json(tenant);
  } catch (err) {
    logger.error({ err }, "Erro ao ler config");
    res.status(500).json({ error: "Erro ao ler config" });
  }
});

// PUT /api/admin/config/:tenantId — atualiza config do tenant
configApiRouter.put("/api/admin/config/:tenantId", async (req, res) => {
  try {
    const content = await fs.readFile(configPath(), "utf-8");
    const tenants = JSON.parse(content);
    const idx = tenants.findIndex((t: any) => t.id === req.params.tenantId);
    if (idx === -1) return res.status(404).json({ error: "Tenant não encontrado" });

    tenants[idx] = { ...tenants[idx], ...req.body, id: req.params.tenantId };
    await fs.writeFile(configPath(), JSON.stringify(tenants, null, 2), "utf-8");
    logger.info(`Config atualizada: ${req.params.tenantId}`);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Erro ao salvar config");
    res.status(500).json({ error: "Erro ao salvar config" });
  }
});
