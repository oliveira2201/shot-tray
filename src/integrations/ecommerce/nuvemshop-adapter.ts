import { EcommerceAdapter } from "./base-adapter.js";
import { NormalizedEvent } from "../../types/integration.js";

/**
 * Adapter para webhooks vindos da integração Nuvemshop (via Mailwizz/middleware).
 *
 * Payload esperado (form-urlencoded ou JSON):
 * {
 *   taginternals: "open" | "pending" | "open,paid,unpacked" | "shipped" | "delivered" | "cancelled" | "abandonou.carrinho" | ...
 *   fname / FNAME: "Nome do cliente"
 *   phone / PHONE: "5511999999999"
 *   email / EMAIL: "cliente@email.com"
 *   tracknumb / TRACKNUMB: "https://..."
 * }
 */

// Mapeia taginternals → flowAlias (alias do flow JSON)
const tagToFlow: Array<{ match: string; exact?: boolean; flowAlias: string }> = [
  // Exatos (combinação de status separada por vírgula)
  { match: "open,pending,unpacked", exact: true, flowAlias: "[EC] Pedido Recebido" },
  { match: "open,paid,unpacked",    exact: true, flowAlias: "[EC] Pedido Pago" },
  // Contains (ordem importa — mais específico primeiro)
  { match: "abandonou.carrinho", flowAlias: "[EC] Carrinho Abandonado1" },
  { match: "delivered",          flowAlias: "[EC] Pedido Entregue" },
  { match: "shipped",            flowAlias: "[EC] Pedido Enviado" },
  { match: "refunded",           flowAlias: "[EC] Pedido Cancelado1" },
  { match: "cancelled",          flowAlias: "[EC] Pedido Cancelado1" },
];

export class NuvemshopAdapter extends EcommerceAdapter {
  normalizeEvent(rawEvent: any): NormalizedEvent | null {
    const tag = (rawEvent?.taginternals || "").toString().trim().toLowerCase();
    if (!tag) return null;

    let flowAlias: string | null = null;

    // Primeiro tenta match exato, depois contains
    for (const rule of tagToFlow) {
      if (rule.exact) {
        if (tag === rule.match) {
          flowAlias = rule.flowAlias;
          break;
        }
      } else {
        if (tag.includes(rule.match)) {
          flowAlias = rule.flowAlias;
          break;
        }
      }
    }

    if (!flowAlias) {
      console.warn(`[NuvemshopAdapter] taginternals não mapeado: "${tag}"`);
      return null;
    }

    const name = rawEvent?.fname || rawEvent?.FNAME || rawEvent?.name || "";
    const phone = rawEvent?.phone || rawEvent?.PHONE || "";
    const trackingUrl = rawEvent?.tracknumb || rawEvent?.TRACKNUMB || "";
    const email = rawEvent?.email || rawEvent?.EMAIL || "";

    return {
      flowAlias,
      customer: {
        name,
        phone,
        tags: []
      },
      data: {
        extra1: trackingUrl,
        extra2: email,
        extra3: "",
        choice: rawEvent?.choice
      }
    };
  }

  isSignatureValid(_req: any, _secret: string): boolean {
    // Webhook do middleware não usa assinatura HMAC
    // Validação pode ser feita por IP ou token no futuro
    return true;
  }
}
