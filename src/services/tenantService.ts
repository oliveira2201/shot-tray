import fs from "fs/promises";
import path from "path";
import { getIntegrationAdapter } from "../integrations/ecommerce/index.js";
import { ShotzapProvider } from "../modules/automation/channels/shotzap/provider.js";
import * as ebenezerTemplates from "../tenants/ebenezer/templates/index.js";
// @ts-ignore
import tenantsData from "../config/tenants.json" assert { type: "json" };
import { IChannelProvider, TenantConfig } from "../types/automation.js";

// Lazy-load do arquivo de secrets (gitignored).
// Cada tenant tem seu próprio token ShotZap. O arquivo não vai pro git.
let _secretsCache: Record<string, { token?: string }> | null = null;
async function loadSecrets(): Promise<Record<string, { token?: string }>> {
  if (_secretsCache) return _secretsCache;
  try {
    const secretsPath = path.join(process.cwd(), "src", "config", "tenants.secrets.json");
    const content = await fs.readFile(secretsPath, "utf-8");
    _secretsCache = JSON.parse(content);
  } catch {
    _secretsCache = {};
  }
  return _secretsCache!;
}

const templateMap: Record<string, any> = {
  ebenezer: ebenezerTemplates
};

const providersMap: Record<string, any> = {
  shotzap: ShotzapProvider
};

export class TenantService {
  static async getTenantConfig(tenantId: string): Promise<TenantConfig | null> {
    const tenant = (tenantsData as any[]).find(t => t.id === tenantId);
    if (!tenant) return null;
    if (tenant.disabled) return null;

    // 1. Resolve Output Provider (Shotzap)
    const ProviderClass = providersMap[tenant.outputProvider];
    if (!ProviderClass) throw new Error(`Provider ${tenant.outputProvider} not found`);

    // Resolver token ShotZap por tenant.
    // Prioridade:
    //   1. tenants.secrets.json (dev local, gitignored)
    //   2. tenant.config.token (inline no tenants.json — não recomendado se repo for público)
    //   3. env var TENANT_<ID>_TOKEN (padrão automático, ideal pra Coolify/prod)
    const secrets = await loadSecrets();
    const envKey = `TENANT_${tenantId.toUpperCase()}_TOKEN`;
    const token =
      secrets[tenantId]?.token ||
      tenant.config.token ||
      process.env[envKey];

    if (!token) {
      throw new Error(
        `Token não configurado para tenant "${tenantId}". ` +
        `Adicione em src/config/tenants.secrets.json (dev) ou defina ${envKey} no ambiente (prod).`
      );
    }

    const outputProvider = new ProviderClass({
      baseUrl: tenant.config.baseUrl,
      token,
      tagsToken: tenant.config.tagsToken,
      tagsCachePath: tenant.config.tagsCachePath,
      paths: tenant.config.paths
    });

    // 2. Resolve Input Adapter (Tray, Nuvem, etc)
    const inputAdapter = getIntegrationAdapter(tenant.inputAdapter);

    // 3. Resolve Templates — tenta JSON primeiro, fallback pro TS estático
    let templates: Record<string, any> = {};
    try {
      const jsonPath = path.join(process.cwd(), "src", "tenants", tenantId, "templates.json");
      const content = await fs.readFile(jsonPath, "utf-8");
      const parsed = JSON.parse(content);
      templates = { ...parsed.text, ...parsed.buttons };
    } catch {
      // Fallback pra templates estáticos (legado)
      const templatesRaw = templateMap[tenantId] || {};
      templates = {
        ...templatesRaw.textTemplates,
        ...templatesRaw.buttonTemplates
      };
    }

    return {
      id: tenant.id,
      name: tenant.name,
      adapterName: tenant.inputAdapter,
      inputAdapter,
      provider: outputProvider as IChannelProvider,
      templates,
      vars: tenant.config.vars || {}
    };
  }
}
