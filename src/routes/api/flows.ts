import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { logger } from "../../utils/logger.js";
// @ts-ignore
import tenantsData from "../../config/tenants.json" assert { type: "json" };

export const flowsApiRouter = Router();

const tenantsDir = () => path.join(process.cwd(), "src", "tenants");

// GET /api/admin/tenants — lista tenants ativos
flowsApiRouter.get("/api/admin/tenants", async (_req, res) => {
  try {
    const tenants = (tenantsData as any[])
      .filter((t) => !t.disabled)
      .map((t) => t.id);
    res.json(tenants);
  } catch (err) {
    logger.error({ err }, "Erro ao listar tenants");
    res.status(500).json({ error: "Erro ao listar tenants" });
  }
});

// GET /api/admin/flows/:tenantId — lista flows de um tenant
flowsApiRouter.get("/api/admin/flows/:tenantId", async (req, res) => {
  const flowsDir = path.join(tenantsDir(), req.params.tenantId, "flows");
  try {
    const files = await fs.readdir(flowsDir);
    const flows = files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
    res.json(flows);
  } catch {
    res.status(404).json({ error: "Tenant não encontrado" });
  }
});

// GET /api/admin/flows/:tenantId/:flowId — retorna um flow
flowsApiRouter.get("/api/admin/flows/:tenantId/:flowId", async (req, res) => {
  const filePath = path.join(
    tenantsDir(),
    req.params.tenantId,
    "flows",
    `${req.params.flowId}.json`
  );
  try {
    const content = await fs.readFile(filePath, "utf-8");
    res.json(JSON.parse(content));
  } catch {
    res.status(404).json({ error: "Flow não encontrado" });
  }
});

// PUT /api/admin/flows/:tenantId/:flowId — salva (atualiza) um flow
flowsApiRouter.put("/api/admin/flows/:tenantId/:flowId", async (req, res) => {
  const filePath = path.join(
    tenantsDir(),
    req.params.tenantId,
    "flows",
    `${req.params.flowId}.json`
  );
  try {
    await fs.writeFile(filePath, JSON.stringify(req.body, null, 2), "utf-8");
    logger.info(`Flow salvo: ${req.params.tenantId}/${req.params.flowId}`);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Erro ao salvar flow");
    res.status(500).json({ error: "Erro ao salvar flow" });
  }
});

// POST /api/admin/flows/:tenantId/:flowId — cria um novo flow
flowsApiRouter.post("/api/admin/flows/:tenantId/:flowId", async (req, res) => {
  const flowsDir = path.join(tenantsDir(), req.params.tenantId, "flows");
  const filePath = path.join(flowsDir, `${req.params.flowId}.json`);
  try {
    await fs.mkdir(flowsDir, { recursive: true });
    // Não sobrescrever se existir
    try {
      await fs.access(filePath);
      res.status(409).json({ error: "Flow já existe" });
      return;
    } catch {
      // não existe, ok
    }
    await fs.writeFile(filePath, JSON.stringify(req.body, null, 2), "utf-8");
    logger.info(`Flow criado: ${req.params.tenantId}/${req.params.flowId}`);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Erro ao criar flow");
    res.status(500).json({ error: "Erro ao criar flow" });
  }
});

// DELETE /api/admin/flows/:tenantId/:flowId — deleta um flow
flowsApiRouter.delete("/api/admin/flows/:tenantId/:flowId", async (req, res) => {
  const filePath = path.join(
    tenantsDir(),
    req.params.tenantId,
    "flows",
    `${req.params.flowId}.json`
  );
  try {
    await fs.unlink(filePath);
    logger.info(`Flow deletado: ${req.params.tenantId}/${req.params.flowId}`);
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Flow não encontrado" });
  }
});
