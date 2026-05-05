import fs from "fs/promises";
import path from "path";
import { getPrisma } from "../prisma.js";
import { logger } from "../../utils/logger.js";

export interface TenantRecord {
  id: string;
  name: string;
  status: string;
  adapterType: string;
  providerType: string;
  adapterConfig: any;
  providerConfig: any;
}

export interface TemplateRecord {
  tenantId: string;
  kind: "text" | "buttons";
  key: string;
  content: any;
}

export interface FlowRecord {
  tenantId: string;
  slug: string;
  title: string;
  aliases: string[];
  description: string;
  steps: any[];
  enabled: boolean;
}

interface RepoOptions {
  fallbackToFiles?: boolean;
}

export class TenantRepository {
  constructor(private opts: RepoOptions = { fallbackToFiles: true }) {}

  async findById(id: string): Promise<TenantRecord | null> {
    try {
      const db = await getPrisma();
      const row = await db.tenant.findUnique({ where: { id } });
      if (row) return row as TenantRecord;
    } catch (err: any) {
      logger.warn({ err: err.message, tenantId: id }, "Falha ao buscar tenant no DB");
    }

    if (!this.opts.fallbackToFiles) return null;
    return this._loadTenantFromFile(id);
  }

  async list(): Promise<TenantRecord[]> {
    try {
      const db = await getPrisma();
      const rows = await db.tenant.findMany({ orderBy: { id: "asc" } });
      return rows as TenantRecord[];
    } catch (err: any) {
      logger.warn({ err: err.message }, "Falha ao listar tenants no DB");
      if (this.opts.fallbackToFiles) return this._loadAllTenantsFromFile();
      return [];
    }
  }

  async listTemplates(tenantId: string): Promise<TemplateRecord[]> {
    try {
      const db = await getPrisma();
      const rows = await db.template.findMany({ where: { tenantId } });
      return rows as TemplateRecord[];
    } catch (err: any) {
      logger.warn({ err: err.message, tenantId }, "Falha ao listar templates");
      if (this.opts.fallbackToFiles) return this._loadTemplatesFromFile(tenantId);
      return [];
    }
  }

  async listFlows(tenantId: string): Promise<FlowRecord[]> {
    try {
      const db = await getPrisma();
      const rows = await db.flow.findMany({ where: { tenantId } });
      return rows as FlowRecord[];
    } catch (err: any) {
      logger.warn({ err: err.message, tenantId }, "Falha ao listar flows");
      if (this.opts.fallbackToFiles) return this._loadFlowsFromFile(tenantId);
      return [];
    }
  }

  // --- Mutations ---

  async upsertTenant(input: TenantRecord): Promise<TenantRecord> {
    const db = await getPrisma();
    const row = await db.tenant.upsert({
      where: { id: input.id },
      create: input,
      update: {
        name: input.name,
        status: input.status,
        adapterType: input.adapterType,
        providerType: input.providerType,
        adapterConfig: input.adapterConfig,
        providerConfig: input.providerConfig,
      },
    });
    return row as TenantRecord;
  }

  async setTenantStatus(id: string, status: "active" | "disabled"): Promise<void> {
    const db = await getPrisma();
    await db.tenant.update({ where: { id }, data: { status } });
  }

  async upsertTemplate(input: TemplateRecord): Promise<TemplateRecord> {
    const db = await getPrisma();
    const row = await db.template.upsert({
      where: { tenantId_kind_key: { tenantId: input.tenantId, kind: input.kind, key: input.key } },
      create: input,
      update: { content: input.content },
    });
    return row as TemplateRecord;
  }

  async deleteTemplate(tenantId: string, kind: string, key: string): Promise<void> {
    const db = await getPrisma();
    await db.template.delete({ where: { tenantId_kind_key: { tenantId, kind, key } } });
  }

  async upsertFlow(input: FlowRecord): Promise<FlowRecord> {
    const db = await getPrisma();
    const row = await db.flow.upsert({
      where: { tenantId_slug: { tenantId: input.tenantId, slug: input.slug } },
      create: input,
      update: {
        title: input.title,
        aliases: input.aliases,
        description: input.description,
        steps: input.steps,
        enabled: input.enabled,
      },
    });
    return row as FlowRecord;
  }

  async deleteFlow(tenantId: string, slug: string): Promise<void> {
    const db = await getPrisma();
    await db.flow.delete({ where: { tenantId_slug: { tenantId, slug } } });
  }

  // --- Fallback de arquivo ---

  private async _loadTenantFromFile(id: string): Promise<TenantRecord | null> {
    const all = await this._loadAllTenantsFromFile();
    return all.find(t => t.id === id) || null;
  }

  private async _loadAllTenantsFromFile(): Promise<TenantRecord[]> {
    try {
      const jsonPath = path.join(process.cwd(), "src", "config", "tenants.json");
      const raw = await fs.readFile(jsonPath, "utf-8");
      const list = JSON.parse(raw);

      // Load secrets (optional file, gitignored)
      let secrets: Record<string, string> = {};
      try {
        const secretsPath = path.join(process.cwd(), "src", "config", "tenants.secrets.json");
        const secretsRaw = await fs.readFile(secretsPath, "utf-8");
        secrets = JSON.parse(secretsRaw);
      } catch (err: any) {
        if (err?.code !== "ENOENT") {
          logger.warn({ err: err.message }, "Falha ao ler tenants.secrets.json");
        }
      }

      return list
        .filter((t: any) => !t.disabled)
        .map((t: any) => ({
          id: t.id,
          name: t.name,
          status: t.disabled ? "disabled" : "active",
          adapterType: t.inputAdapter,
          providerType: t.outputProvider,
          adapterConfig: { vars: t.config?.vars || {} },
          providerConfig: {
            baseUrl: t.config?.baseUrl,
            token: secrets[t.id],
            paths: t.config?.paths || {},
            tagsCachePath: t.config?.tagsCachePath,
          },
        }));
    } catch (err: any) {
      logger.warn({ err: err.message }, "Falha no fallback de tenants.json");
      return [];
    }
  }

  private async _loadTemplatesFromFile(tenantId: string): Promise<TemplateRecord[]> {
    try {
      const jsonPath = path.join(process.cwd(), "src", "tenants", tenantId, "templates.json");
      const raw = await fs.readFile(jsonPath, "utf-8");
      const parsed = JSON.parse(raw);
      const out: TemplateRecord[] = [];
      for (const [key, content] of Object.entries(parsed.text || {})) {
        out.push({ tenantId, kind: "text", key, content });
      }
      for (const [key, content] of Object.entries(parsed.buttons || {})) {
        out.push({ tenantId, kind: "buttons", key, content });
      }
      return out;
    } catch (err: any) {
      if (err?.code !== "ENOENT") {
        logger.warn({ err: err.message, tenantId }, "Falha ao ler templates do arquivo");
      }
      return [];
    }
  }

  private async _loadFlowsFromFile(tenantId: string): Promise<FlowRecord[]> {
    try {
      const dir = path.join(process.cwd(), "src", "tenants", tenantId, "flows");
      const files = await fs.readdir(dir);
      const out: FlowRecord[] = [];
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const raw = await fs.readFile(path.join(dir, file), "utf-8");
        const parsed = JSON.parse(raw);
        out.push({
          tenantId,
          slug: file.replace(".json", ""),
          title: parsed.title,
          aliases: parsed.aliases || [],
          description: parsed.description || "",
          steps: parsed.steps,
          enabled: true,
        });
      }
      return out;
    } catch (err: any) {
      if (err?.code !== "ENOENT") {
        logger.warn({ err: err.message, tenantId }, "Falha ao ler flows do arquivo");
      }
      return [];
    }
  }
}
