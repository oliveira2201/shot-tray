import crypto from "crypto";
import { EcommerceAdapter } from "./base-adapter.js";
import { NormalizedEvent } from "../../types/integration.js";
import { TrayClient } from "./tray/client.js";
import { logger } from "../../utils/logger.js";

const statusToFlow: Array<{ match: string | RegExp; flowAlias: (tenantPrefix: string) => string }> = [
  { match: /aguardando.*pagamento|pendente/i, flowAlias: p => `${p} Pedido Recebido` },
  { match: /pagamento.*aprovado|pago|paid/i, flowAlias: p => `${p} Pedido Pago` },
  { match: /enviado|shipped|despachado/i, flowAlias: p => `${p} Pedido Enviado` },
  { match: /entregue|delivered/i, flowAlias: p => `${p} Pedido Entregue` },
  { match: /cancelado|canceled|cancelled/i, flowAlias: p => `${p} Pedido Cancelado1` },
];

export class TrayAdapter extends EcommerceAdapter {
  constructor(private tenantPrefix: string = "[OJ]") { super(); }

  async normalizeEventAsync(rawEvent: any, tenantId: string): Promise<NormalizedEvent | null> {
    const scope = (rawEvent?.scope_name || "").toString().toLowerCase();
    const scopeId = rawEvent?.scope_id?.toString();
    const act = (rawEvent?.act || "").toString().toLowerCase();

    // Aceita apenas escopos que processamos: order, abandoned_cart (sintético do nosso cron)
    if ((scope !== "order" && scope !== "abandoned_cart") || !scopeId) {
      logger.info({ scope, scopeId, act, tenantId }, "TrayAdapter: webhook ignorado (escopo não suportado ou sem id)");
      return null;
    }

    // Carrinho abandonado vem do nosso cron já com payload pronto — não precisa lookup
    if (scope === "abandoned_cart") {
      const phone = (rawEvent.cellphone || rawEvent.phone || "").toString();
      const name = (rawEvent.customer_name || rawEvent.name || "").toString();
      return {
        flowAlias: `${this.tenantPrefix} Pedido Carrinho Abandonado1`,
        customer: { name, phone, tags: [] },
        data: {
          email: rawEvent.email,
          extra1: rawEvent.cart_url || "",
          extra2: rawEvent.cart_url || "",
          extra3: rawEvent.products || "",
        },
      };
    }

    // act=delete → pedido cancelado/excluído, sem lookup possível (já não existe)
    if (act === "delete") {
      logger.info({ tenantId, scopeId }, "TrayAdapter: order_delete → mapeando para Pedido Cancelado");
      return {
        flowAlias: `${this.tenantPrefix} Pedido Cancelado1`,
        customer: { name: "", phone: "", tags: [] },
        data: { extra1: "", extra2: "", extra3: "" },
      };
    }

    let client: TrayClient;
    try {
      client = await TrayClient.forTenant(tenantId);
    } catch (err: any) {
      logger.warn({ err: err.message, tenantId }, "TrayAdapter: cliente indisponível");
      return null;
    }

    const order = await client.getOrder(scopeId);
    if (!order) return null;

    const status = (order.status || "").toString();
    const rule = statusToFlow.find(r =>
      typeof r.match === "string" ? status.toLowerCase().includes(r.match.toLowerCase()) : r.match.test(status)
    );
    if (!rule) {
      logger.info({ tenantId, scopeId, status }, "TrayAdapter: status não mapeado");
      return null;
    }

    const flowAlias = rule.flowAlias(this.tenantPrefix);
    const phone = order.customer?.cellphone || order.customer?.phone || "";
    const name = order.customer?.name || "";

    return {
      flowAlias,
      customer: { name, phone, tags: [] },
      data: {
        email: order.customer?.email,
        extra1: order.tracking_url || order.link_track || order.link_payment || "",
        extra2: order.link_payment || "",
        extra3: "",
        choice: rawEvent?.choice,
      },
    };
  }

  normalizeEvent(_rawEvent: any): NormalizedEvent | null {
    throw new Error("TrayAdapter requires async — use normalizeEventAsync(raw, tenantId)");
  }

  isSignatureValid(req: any, secret: string): boolean {
    const sig = req.headers["x-tray-signature"];
    if (!sig) return false;
    const expected = crypto.createHmac("sha256", secret).update(JSON.stringify(req.body)).digest("hex");
    return sig === expected;
  }
}
