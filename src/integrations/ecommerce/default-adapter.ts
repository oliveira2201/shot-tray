import crypto from "crypto";
import { EcommerceAdapter } from "./base-adapter.js";
import { NormalizedEvent } from "../../types/integration.js";

const statusMap = new Map<string, string>([
  ["pedido_recebido", "[EBE] Pedido Recebido"],
  ["pedido_pago", "[EBE] Pedido Pago"],
  ["pedido_enviado", "_[EBE] Pedido Enviado"],
  ["pedido_entregue", "[EBE] Pedido Entregue"],
  ["pedido_cancelado", "[EBE] Pedido Cancelado1"],
  ["carrinho_abandonado", "_[EBE] Carrinho Abandonado1"]
]);

export class DefaultAdapter extends EcommerceAdapter {
  normalizeEvent(rawEvent: any): NormalizedEvent | null {
    const status = (rawEvent?.status || rawEvent?.type || rawEvent?.event || "").toString().toLowerCase();
    
    let flowAlias: string | null = null;
    for (const [key, flow] of statusMap.entries()) {
      if (status.includes(key)) {
        flowAlias = flow;
        break;
      }
    }

    if (!flowAlias) return null;

    return {
      flowAlias,
      customer: {
        name: rawEvent?.customer?.name || rawEvent?.name,
        phone: rawEvent?.customer?.phone || rawEvent?.phone,
        tags: rawEvent?.tags || rawEvent?.customer?.tags || []
      },
      data: {
        extra1: rawEvent?.order?.trackingUrl || rawEvent?.trackingUrl,
        extra2: rawEvent?.order?.invoiceUrl || rawEvent?.invoiceUrl,
        extra3: rawEvent?.order?.itemsSummary || rawEvent?.itemsSummary,
        choice: rawEvent?.choice
      }
    };
  }

  isSignatureValid(req: any, secret: string): boolean {
    const signature = req.headers["x-erp-signature"];
    if (!signature) return false;

    const expected = crypto
      .createHmac("sha256", secret)
      .update(JSON.stringify(req.body))
      .digest("hex");

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }
}
