import { Router } from "express";
import { TenantRepository } from "../../lib/repositories/tenant-repository.js";
import { logger } from "../../utils/logger.js";

export const overviewApiRouter = Router();

const repo = new TenantRepository({ fallbackToFiles: process.env.DISABLE_FILE_FALLBACK !== "1" });

// GET /api/admin/overview/:tenantId
//
// Retorna apenas dados reais do DB:
//   - tenant config
//   - flows cadastrados (com seus aliases — que são as "regras de roteamento")
//   - templates (count por tipo)
//
// Sem regras hardcoded, sem placeholders. O que você cadastra é o que aparece.
overviewApiRouter.get("/api/admin/overview/:tenantId", async (req, res): Promise<any> => {
  const tenantId = req.params.tenantId as string;

  try {
    const tenant = await repo.findById(tenantId);
    if (!tenant) return res.status(404).json({ error: "Tenant não encontrado" });

    const flowRows = await repo.listFlows(tenantId);
    const templateRows = await repo.listTemplates(tenantId);

    const flows = flowRows.map(f => ({
      slug: f.slug,
      title: f.title,
      description: f.description,
      aliases: f.aliases || [],
      enabled: f.enabled,
      stepsCount: Array.isArray(f.steps) ? f.steps.length : 0,
      stepTypes: Array.isArray(f.steps) ? Array.from(new Set((f.steps as any[]).map(s => s.type))) : [],
    }));

    const templatesByKind: Record<string, number> = {};
    for (const t of templateRows) {
      templatesByKind[t.kind] = (templatesByKind[t.kind] || 0) + 1;
    }

    const tokenMasked = (() => {
      const tk = (tenant.providerConfig as any)?.token;
      return tk ? "***" + String(tk).slice(-4) : null;
    })();

    res.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        status: tenant.status,
        adapter: tenant.adapterType,
        provider: tenant.providerType,
        webhookUrl: `/webhooks/${tenant.id}`,
        baseUrl: (tenant.providerConfig as any)?.baseUrl,
        token: tokenMasked,
        adapterConfig: tenant.adapterConfig,
      },
      flows,
      templates: {
        total: templateRows.length,
        byKind: templatesByKind,
      },
    });
  } catch (err) {
    logger.error({ err }, "Erro ao gerar overview");
    res.status(500).json({ error: "Erro ao gerar overview" });
  }
});
