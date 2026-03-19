import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { logger } from "../../utils/logger.js";

export const templatesApiRouter = Router();

const templatesPath = (tenantId: string) =>
  path.join(process.cwd(), "src", "tenants", tenantId, "templates.json");

// GET /api/templates/:tenantId
templatesApiRouter.get("/api/templates/:tenantId", async (req, res) => {
  try {
    const content = await fs.readFile(templatesPath(req.params.tenantId), "utf-8");
    res.json(JSON.parse(content));
  } catch {
    res.status(404).json({ error: "Templates não encontrados" });
  }
});

// PUT /api/templates/:tenantId — salva todos
templatesApiRouter.put("/api/templates/:tenantId", async (req, res) => {
  try {
    await fs.writeFile(templatesPath(req.params.tenantId), JSON.stringify(req.body, null, 2), "utf-8");
    logger.info(`Templates salvos: ${req.params.tenantId}`);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Erro ao salvar templates");
    res.status(500).json({ error: "Erro ao salvar templates" });
  }
});

// PUT /api/templates/:tenantId/:type/:key — salva um template específico
templatesApiRouter.put("/api/templates/:tenantId/:type/:key", async (req, res) => {
  const { tenantId, type, key } = req.params;
  try {
    const content = await fs.readFile(templatesPath(tenantId), "utf-8");
    const templates = JSON.parse(content);
    if (!templates[type]) templates[type] = {};
    templates[type][key] = req.body.value;
    await fs.writeFile(templatesPath(tenantId), JSON.stringify(templates, null, 2), "utf-8");
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Erro ao salvar template");
    res.status(500).json({ error: "Erro ao salvar template" });
  }
});
