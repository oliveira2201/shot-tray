import { getIntegrationAdapter } from "../integrations/ecommerce/index.js";
import { ShotzapProvider } from "../modules/automation/channels/shotzap/provider.js";
import { TenantRepository } from "../lib/repositories/tenant-repository.js";
import { IChannelProvider, TenantConfig } from "../types/automation.js";
import { logger } from "../utils/logger.js";

const providersMap: Record<string, any> = { shotzap: ShotzapProvider };

const CACHE_TTL_MS = 30_000;
interface CacheEntry { config: TenantConfig | null; expiresAt: number; }
const cache = new Map<string, CacheEntry>();

const repo = new TenantRepository({ fallbackToFiles: process.env.DISABLE_FILE_FALLBACK !== "1" });

export class TenantService {
  static async getTenantConfig(tenantId: string): Promise<TenantConfig | null> {
    const cached = cache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) return cached.config;

    const config = await this._build(tenantId);
    cache.set(tenantId, { config, expiresAt: Date.now() + CACHE_TTL_MS });
    return config;
  }

  static invalidate(tenantId: string) { cache.delete(tenantId); }
  static invalidateAll() { cache.clear(); }

  private static async _build(tenantId: string): Promise<TenantConfig | null> {
    const tenant = await repo.findById(tenantId);
    if (!tenant || tenant.status !== "active") return null;

    const ProviderClass = providersMap[tenant.providerType];
    if (!ProviderClass) {
      logger.error({ providerType: tenant.providerType, tenantId }, "Provider type desconhecido");
      return null;
    }

    const pCfg = tenant.providerConfig as any;
    if (!pCfg?.token) {
      logger.error({ tenantId }, "Tenant sem token no providerConfig");
      return null;
    }

    const provider = new ProviderClass({
      baseUrl: pCfg.baseUrl,
      token: pCfg.token,
      tagsCachePath: pCfg.tagsCachePath,
      paths: pCfg.paths,
    });

    const inputAdapter = getIntegrationAdapter(tenant.adapterType);

    // Templates: combine text + buttons into a single flat object
    const templateRows = await repo.listTemplates(tenantId);
    const templates: Record<string, any> = {};
    for (const t of templateRows) templates[t.key] = t.content;

    return {
      id: tenant.id,
      name: tenant.name,
      adapterName: tenant.adapterType,
      inputAdapter,
      provider: provider as IChannelProvider,
      templates,
    };
  }
}
