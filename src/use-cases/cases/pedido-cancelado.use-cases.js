import { textTemplates } from "../templates/index.js";

const paidOrReceivedTags = [
  "[EBE] Pedido Pago",
  "[EBE] Pedido Recebido",
  "[EBE] Pedido Recebido1",
  "[EBE] Pedido Recebido2",
  "[EBE] Pedido Recebido3"
];

export const pedidoCanceladoUseCases = [
  {
    id: "pedidoCancelado1",
    title: "Pedido Cancelado 1",
    aliases: ["[EBE] Pedido Cancelado1"],
    description: "Primeiro contato após cancelamento.",
    steps: [
      { type: "addTag", label: "Marcar etapa cancelado 2", tag: "[EBE] Pedido Cancelado2" },
      { type: "sendText", label: "Enviar aviso de cancelamento", text: textTemplates.pedidoCancelado1 }
    ]
  },
  {
    id: "pedidoCancelado2",
    title: "Pedido Cancelado 2",
    aliases: ["[EBE] Pedido Cancelado2"],
    description: "Segundo contato após cancelamento.",
    steps: [
      { type: "removeTag", label: "Remover tag cancelado 2", tag: "[EBE] Pedido Cancelado2" },
      { type: "stopIfHasAnyTag", label: "Encerrar se já pagou/recebeu", tags: paidOrReceivedTags },
      { type: "addTag", label: "Marcar etapa cancelado 3", tag: "[EBE] Pedido Cancelado3" },
      { type: "sendText", label: "Enviar segunda tentativa", text: textTemplates.pedidoCancelado2 }
    ]
  },
  {
    id: "pedidoCancelado3",
    title: "Pedido Cancelado 3",
    aliases: ["[EBE] Pedido Cancelado3", "[EBE] Pedido Cancelado3 (1)"],
    description: "Último contato após cancelamento.",
    steps: [
      { type: "stopIfHasAnyTag", label: "Encerrar se já pagou/recebeu", tags: paidOrReceivedTags },
      { type: "sendText", label: "Enviar última tentativa", text: textTemplates.pedidoCancelado3 }
    ]
  }
];
