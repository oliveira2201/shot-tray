import { buttonTemplates, textTemplates } from "../templates/index.js";

export const pedidoEntregueUseCases = [
  {
    id: "pedidoEntregue",
    title: "Pedido Entregue",
    aliases: ["[EBE] Pedido Entregue"],
    description: "Confirma entrega e oferece grupo VIP.",
    steps: [
      { type: "sendText", label: "Confirmar entrega", text: textTemplates.pedidoEntregue },
      { type: "wait", label: "Aguardar 10s", seconds: 10 },
      { type: "sendButtons", label: "Convite VIP", template: buttonTemplates.pedidoEntregueVip },
      { type: "wait", label: "Aguardar 3s", seconds: 3 }
    ]
  }
];
