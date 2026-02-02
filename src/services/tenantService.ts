import { env } from "../config/env.js";
import { getIntegrationAdapter } from "../integrations/ecommerce/index.js";
import { ShotzapProvider } from "../modules/automation/channels/shotzap/provider.js";
import * as ebenezerTemplates from "../tenants/ebenezer/templates/index.js";
// @ts-ignore
import tenantsData from "../config/tenants.json" assert { type: "json" };
import { TenantConfig, IChannelProvider } from "../types/automation.js";

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

    // 1. Resolve Output Provider (Shotzap)
    const ProviderClass = providersMap[tenant.outputProvider];
    if (!ProviderClass) throw new Error(`Provider ${tenant.outputProvider} not found`);

    const outputProvider = new ProviderClass({
      baseUrl: tenant.config.baseUrl,
      token: tenant.config.token,
      paths: tenant.config.paths
    });

    // 2. Resolve Input Adapter (Tray, Nuvem, etc)
    const inputAdapter = getIntegrationAdapter(tenant.inputAdapter);

    // 3. Resolve Templates
    const templatesRaw = templateMap[tenantId] || {};
    const templates = {
      ...templatesRaw.textTemplates,
      ...templatesRaw.buttonTemplates
    };

    return {
      id: tenant.id,
      name: tenant.name,
      inputAdapter,
      provider: outputProvider as IChannelProvider,
      templates
    };
  }
}
