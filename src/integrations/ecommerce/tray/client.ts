import axios from "axios";
import { TenantRepository } from "../../../lib/repositories/tenant-repository.js";
import { logger } from "../../../utils/logger.js";
import { TrayOrder } from "./types.js";

const repo = new TenantRepository({ fallbackToFiles: false });

export class TrayClient {
  private apiAddress: string;
  private http: ReturnType<typeof axios.create>;

  static async forTenant(tenantId: string): Promise<TrayClient> {
    const tenant = await repo.findById(tenantId);
    if (!tenant) throw new Error(`Tenant ${tenantId} não encontrado`);
    const apiAddress = (tenant.adapterConfig as any)?.apiAddress;
    if (!apiAddress) throw new Error(`Tenant ${tenantId} sem apiAddress da Tray`);
    const token = await repo.findOAuthToken(tenantId, "tray");
    if (!token) throw new Error(`Tenant ${tenantId} sem OAuthToken da Tray`);
    return new TrayClient(tenantId, apiAddress, token.accessToken);
  }

  constructor(public tenantId: string, apiAddress: string, accessToken: string) {
    this.apiAddress = apiAddress.replace(/\/$/, "");
    this.http = axios.create({
      baseURL: this.apiAddress,
      params: { access_token: accessToken },
      timeout: 15000,
    });
  }

  async getOrder(orderId: string | number): Promise<TrayOrder | null> {
    try {
      const res = await this.http.get(`/orders/${orderId}`);
      const data: any = res.data;
      return (data?.Order || data) as TrayOrder;
    } catch (err: any) {
      logger.warn({ err: err.message, tenantId: this.tenantId, orderId }, "TrayClient.getOrder falhou");
      return null;
    }
  }

  /**
   * Lista carrinhos da loja (pra detecção de carrinho abandonado).
   * Doc: API de Listagem de Carrinhos — GET /carts
   *
   * @param opts.dateStart YYYY-MM-DD
   * @param opts.dateEnd   YYYY-MM-DD
   * @param opts.hasCustomer "1" pra retornar só carrinhos com comprador identificado
   */
  async listCarts(opts: { dateStart?: string; dateEnd?: string; hasCustomer?: string } = {}): Promise<any[]> {
    try {
      const params: Record<string, string> = {};
      if (opts.hasCustomer) params.has_customer = opts.hasCustomer;
      // `date_time` aceita range no formato `[start],[end]` segundo a doc
      if (opts.dateStart && opts.dateEnd) {
        params.date_time = `${opts.dateStart},${opts.dateEnd}`;
      } else if (opts.dateStart) {
        params.date_time = opts.dateStart;
      }
      const res = await this.http.get(`/carts`, { params });
      const data: any = res.data;
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.Carts)) return data.Carts;
      if (Array.isArray(data?.carts)) return data.carts;
      return [];
    } catch (err: any) {
      logger.warn({ err: err.message, tenantId: this.tenantId }, "TrayClient.listCarts falhou");
      return [];
    }
  }

  static async refresh(tenantId: string): Promise<boolean> {
    const tenant = await repo.findById(tenantId);
    const token = await repo.findOAuthToken(tenantId, "tray");
    if (!tenant || !token?.refreshToken) {
      logger.warn({ tenantId }, "Refresh sem refresh_token disponível");
      return false;
    }
    const apiAddress = (tenant.adapterConfig as any)?.apiAddress;
    try {
      const res = await axios.get(`${apiAddress}/auth`, {
        params: { refresh_token: token.refreshToken },
        timeout: 15000,
      });
      const body: any = res.data || {};
      const accessToken = body.access_token;
      const refreshToken = body.refresh_token || token.refreshToken;
      const expiresIn = Number(body.expires_in || 3600);
      if (!accessToken) throw new Error("Resposta sem access_token");
      await repo.upsertOAuthToken({
        tenantId,
        provider: "tray",
        accessToken,
        refreshToken,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
        scope: body.scope || null,
      });
      logger.info({ tenantId, expiresIn }, "Tray token refreshed");
      return true;
    } catch (err: any) {
      logger.error({ err: err.message, tenantId }, "Refresh Tray falhou");
      await repo.incrementRefreshFailure(tenantId, "tray");
      return false;
    }
  }
}
