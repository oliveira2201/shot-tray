import { Router, Request, Response } from "express";
import fs from "fs-extra";
import path from "path";
import axios from "axios";
import { logger } from "../../utils/logger.js";

export const tagsRouter = Router();

const TENANTS_DIR = path.resolve(process.cwd(), "src", "tenants");

/**
 * Extrai todas as tags usadas nos flows de um tenant
 */
function extractFlowTags(tenantId: string): string[] {
  const flowsDir = path.join(TENANTS_DIR, tenantId, "flows");
  if (!fs.existsSync(flowsDir)) return [];

  const tags = new Set<string>();
  const files = fs.readdirSync(flowsDir).filter(f => f.endsWith(".json"));

  for (const file of files) {
    const content = fs.readJsonSync(path.join(flowsDir, file));
    const steps = content.steps || [];
    for (const step of steps) {
      if (step.tag) tags.add(step.tag);
      if (step.tags) step.tags.forEach((t: string) => tags.add(t));
      if (step.cancelIfTags) step.cancelIfTags.forEach((t: string) => tags.add(t));
      if (step.conditions) {
        for (const c of step.conditions) {
          if (c.actions) {
            for (const a of c.actions) {
              if (a.tag) tags.add(a.tag);
            }
          }
        }
      }
      // aliases também
      if (content.aliases) content.aliases.forEach((a: string) => {
        if (!a.startsWith("_")) tags.add(a);
      });
    }
  }

  return Array.from(tags).sort();
}

/**
 * Extrai JWT token de um header curl ou string direta
 */
function extractJwtToken(input: string): string {
  // Se é um curl completo, extrair o Bearer token
  const bearerMatch = input.match(/Bearer\s+([A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+)/);
  if (bearerMatch) return bearerMatch[1];

  // Se já é um JWT direto
  const jwtMatch = input.trim().match(/^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/);
  if (jwtMatch) return jwtMatch[0];

  return input.trim();
}

/**
 * GET /api/admin/tags/:tenantId/status
 * Retorna tags dos flows e status na Shotzap
 */
tagsRouter.get("/api/admin/tags/:tenantId/status", async (req: Request, res: Response): Promise<any> => {
  const { tenantId } = req.params;

  try {
    const flowTags = extractFlowTags(tenantId as string);

    // Ler config do tenant pra pegar baseUrl e token
    const tenantsPath = path.resolve(process.cwd(), "src", "config", "tenants.json");
    const tenants = fs.readJsonSync(tenantsPath);
    const tenant = tenants.find((t: any) => t.id === tenantId);

    if (!tenant) {
      return res.json({ flowTags, shotzapTags: [], missing: flowTags, extra: [] });
    }

    // Tentar listar tags da Shotzap com o token do tenant
    let shotzapTags: { id: number; name: string }[] = [];
    try {
      const resp = await axios.get(`${tenant.config.baseUrl}/api/tags`, {
        headers: { Authorization: `Bearer ${tenant.config.token}` },
      });
      const respData = resp.data as any;
      const data = Array.isArray(respData) ? respData : respData?.tags || [];
      shotzapTags = data.map((t: any) => ({ id: t.id, name: t.name }));
    } catch {
      // Token pode não ter permissão de leitura
    }

    const shotzapNames = shotzapTags.map(t => t.name);
    const missing = flowTags.filter(t => !shotzapNames.includes(t));
    const extra = shotzapTags.filter(t => !flowTags.includes(t.name));

    res.json({ flowTags, shotzapTags, missing, extra });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/tags/:tenantId/sync
 * Cria tags faltantes na Shotzap usando JWT token
 */
tagsRouter.post("/api/admin/tags/:tenantId/sync", async (req: Request, res: Response): Promise<any> => {
  const { tenantId } = req.params;
  const { jwtToken: rawToken } = req.body;

  if (!rawToken) {
    return res.status(400).json({ error: "jwtToken é obrigatório" });
  }

  const jwtToken = extractJwtToken(rawToken);

  try {
    const flowTags = extractFlowTags(tenantId as string);

    // Ler config do tenant
    const tenantsPath = path.resolve(process.cwd(), "src", "config", "tenants.json");
    const tenants = fs.readJsonSync(tenantsPath);
    const tenant = tenants.find((t: any) => t.id === tenantId);
    const baseUrl = tenant?.config?.baseUrl || "https://api.shotzap.com.br";

    // Listar tags existentes
    let existing: { id: number; name: string }[] = [];
    try {
      const resp = await axios.get(`${baseUrl}/tags`, {
        headers: { Authorization: `Bearer ${jwtToken}` },
      });
      const respData = resp.data as any;
      const data = respData?.tags || respData || [];
      existing = Array.isArray(data) ? data.map((t: any) => ({ id: t.id, name: t.name })) : [];
    } catch (err: any) {
      return res.status(400).json({ error: `Falha ao listar tags: ${err.message}. Token JWT válido?` });
    }

    const existingNames = existing.map(t => t.name);
    const missing = flowTags.filter(t => !existingNames.includes(t));

    if (missing.length === 0) {
      return res.json({ message: "Todas as tags já existem", created: [], existing: existing.length, flowTags: flowTags.length });
    }

    // Criar tags faltantes
    const created: { name: string; id: number }[] = [];
    const errors: { name: string; error: string }[] = [];

    for (const tagName of missing) {
      try {
        const resp = await axios.post(`${baseUrl}/tags`, {
          name: tagName,
          color: "#5f6368",
          kanban: 1,
          prioridade: 0,
          automation: 0,
          tagType: "Atendimento",
          weekends: 0,
          userId: 854,
        }, {
          headers: { Authorization: `Bearer ${jwtToken}`, "Content-Type": "application/json" },
        });
        const createData = resp.data as any;
        created.push({ name: tagName, id: createData.id });
        logger.info({ tag: tagName, id: createData.id }, "Tag criada na Shotzap");
      } catch (err: any) {
        errors.push({ name: tagName, error: err.response?.data?.error || err.message });
      }
    }

    res.json({
      message: `${created.length} tags criadas, ${errors.length} erros`,
      created,
      errors,
      existing: existing.length,
      flowTags: flowTags.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
