const normalizeStatus = (value) => (value || "").toString().toLowerCase();

const statusMap = new Map([
  ["pedido_recebido", "[EBE] Pedido Recebido"],
  ["pedido_pago", "[EBE] Pedido Pago"],
  ["pedido_enviado", "_[EBE] Pedido Enviado"],
  ["pedido_entregue", "[EBE] Pedido Entregue"],
  ["pedido_cancelado", "[EBE] Pedido Cancelado1"],
  ["carrinho_abandonado", "_[EBE] Carrinho Abandonado1"]
]);

export const mapErpEventToFlow = (event) => {
  const status = normalizeStatus(event?.status || event?.type || event?.event);

  for (const [key, flow] of statusMap.entries()) {
    if (status.includes(key)) {
      return flow;
    }
  }

  return null;
};
