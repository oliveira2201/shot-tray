import { buttonTemplates } from "../templates/index.js";

export const pedidoPagoUseCases = [
  {
    id: "pedidoPago",
    title: "Pedido Pago",
    aliases: ["[EBE] Pedido Pago"],
    description: "Limpa tags anteriores e envia confirmação de pagamento.",
    steps: [
      { type: "addTag", label: "Marcar pago", tag: "[EBE] Pedido Pago" },
      { type: "removeTag", label: "Limpar Recebido", tag: "[EBE] Pedido Recebido" },
      { type: "removeTag", label: "Limpar Recebido1", tag: "[EBE] Pedido Recebido1" },
      { type: "removeTag", label: "Limpar Recebido2", tag: "[EBE] Pedido Recebido2" },
      { type: "removeTag", label: "Limpar Recebido3", tag: "[EBE] Pedido Recebido3" },
      { type: "removeTag", label: "Limpar Enviado", tag: "[EBE] Pedido Enviado" },
      { type: "removeTag", label: "Limpar Cancelado1", tag: "[EBE] Pedido Cancelado1" },
      { type: "removeTag", label: "Limpar Cancelado2", tag: "[EBE] Pedido Cancelado2" },
      { type: "removeTag", label: "Limpar Cancelado3", tag: "[EBE] Pedido Cancelado3" },
      { type: "removeTag", label: "Limpar Carrinho1", tag: "[EBE] Pedido Carrinho Abandonado1" },
      { type: "removeTag", label: "Limpar Carrinho2", tag: "[EBE] Pedido Carrinho Abandonado2" },
      { type: "removeTag", label: "Limpar Carrinho3", tag: "[EBE] Pedido Carrinho Abandonado3" },
      { type: "sendButtons", label: "Enviar confirmação", template: buttonTemplates.pedidoPago },
      { type: "wait", label: "Aguardar 2s", seconds: 2 }
    ]
  }
];
