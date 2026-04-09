import { EcommerceAdapter } from "./base-adapter.js";
import { NormalizedEvent } from "../../types/integration.js";

/**
 * Adapter para webhooks vindos da integração Nuvemshop (via n8n/middleware).
 *
 * Payload esperado (form-urlencoded ou JSON):
 * {
 *   taginternals: "open" | "pending" | "open,paid,unpacked" | "shipped" | "delivered" | "cancelled" | "abandonou.carrinho" | ...
 *   fname / FNAME / nome / name: "Nome do cliente"
 *   phone / PHONE / celular: "5511999999999"
 *   email / EMAIL: "cliente@email.com"
 *   extra1 / tracknumb / TRACKNUMB: URL de rastreio / link do pedido
 *   extra2 / checkout_url / abandoned_checkout_url: URL do carrinho abandonado
 *   extra3 / products / product_abandoned_checkout: Nome dos produtos
 * }
 */

// Mapeia taginternals → flowAlias (alias do flow JSON).
//
// Baseado na análise de TODOS os 14 workflows [MD+SZ] do n8n de produção:
// os Switches desses workflows usam estes valores de taginternals (puros ou em
// combinação separada por vírgula):
//
//   Pedido Recebido:     open, open1, open2, open3, pending
//   Pedido Pago:         paid
//   Pedido Enviado:      shipped
//   Pedido Entregue:     delivered
//   Pedido Cancelado:    cancelled, cancelled2, cancelled3, refunded
//   Carrinho Abandonado: abandonou.carrinho, cartaband2, cartaband3
//
// Valores REAIS observados em execuções (Ebenezer + Trijeito):
//   "paid", "delivered", "cancelled"
//   "shipped,open,voided,unpacked"       (combinação — contém "shipped")
//   "abandonou.carrinho1,cartaband2"     (combinação — contém "abandonou.carrinho")
//
// Valores combinados do fluxo legado LumiVittá/Linda Moça/Thalvion:
//   "open,pending,unpacked", "open,paid,unpacked", "open,paid,shipped"
//   "cancelled,pending,unpacked", "cancelled,refunded,unpacked", "cancelled,voided,unpacked"
//
// ⚠️ A ORDEM é CRÍTICA — matches `contains` são avaliados de cima pra baixo.
//   - cancelled3/cancelled2 DEVEM vir antes de "cancelled" (substring)
//   - cartaband3/cartaband2 antes de valores genéricos
//   - shipped antes de "open" (porque "shipped,open,voided,unpacked" tem os dois)
//   - "open" é o último, como fallback
// Prefixo `[EC]` conforme tags já existentes no ShotZap do cliente.
// Variantes numeradas (Recebido1/2/3, Cancelado2/3, Carrinho Abandonado2/3)
// são disparadas internamente pelos follow-ups dos flows (cancelableWait),
// não chegam pelo webhook em produção — só o evento inicial chega.
const tagToFlow: Array<{ match: string; exact?: boolean; flowAlias: string }> = [
  { match: "abandonou.carrinho", flowAlias: "[EC] Pedido Carrinho Abandonado1" },
  // Enviado antes de "open" por causa de "shipped,open,voided,unpacked"
  { match: "shipped",            flowAlias: "[EC] Pedido Enviado" },
  { match: "delivered",          flowAlias: "[EC] Pedido Entregue" },
  { match: "refunded",           flowAlias: "[EC] Pedido Cancelado1" },
  { match: "cancelled",          flowAlias: "[EC] Pedido Cancelado1" },
  { match: "paid",               flowAlias: "[EC] Pedido Pago" },
  { match: "pending",            flowAlias: "[EC] Pedido Recebido" },
  { match: "open",               flowAlias: "[EC] Pedido Recebido" },
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

    const name = rawEvent?.fname || rawEvent?.FNAME || rawEvent?.nome || rawEvent?.name || "";

    // Phone — strip "+" e espaços (Nuvemshop/MauticDB às vezes envia "+5511...")
    const rawPhone = (rawEvent?.phone || rawEvent?.PHONE || rawEvent?.celular || "").toString();
    const phone = rawPhone.replace(/[+\s]/g, "");

    const email = rawEvent?.email || rawEvent?.EMAIL || "";

    // Extras — prioridade pra chave literal extra1/2/3 no payload, senão fallback
    const extra1 =
      rawEvent?.extra1 ||
      rawEvent?.tracknumb ||
      rawEvent?.TRACKNUMB ||
      rawEvent?.tracking_url ||
      rawEvent?.order_url ||
      "";

    const extra2 =
      rawEvent?.extra2 ||
      rawEvent?.checkout_url ||
      rawEvent?.abandoned_checkout_url ||
      rawEvent?.ABANDONED_CHECKOUT_URL ||
      rawEvent?.cart_url ||
      "";

    // Produto do carrinho abandonado: o payload real da Nuvemshop envia em `NAME` (uppercase)
    const extra3 =
      rawEvent?.extra3 ||
      rawEvent?.products ||
      rawEvent?.product_abandoned_checkout ||
      rawEvent?.product_name ||
      rawEvent?.NAME ||
      "";

    return {
      flowAlias,
      customer: {
        name,
        phone,
        tags: []
      },
      data: {
        email,
        extra1,
        extra2,
        extra3,
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
