import { buttonTemplates, textTemplates } from "../templates/index.js";

const paidOrReceivedTags = [
  "[EBE] Pedido Pago",
  "[EBE] Pedido Recebido",
  "[EBE] Pedido Recebido1",
  "[EBE] Pedido Recebido2",
  "[EBE] Pedido Recebido3"
];

export const carrinhoUseCases = [
  {
    id: "carrinhoAbandonado1",
    title: "Carrinho Abandonado 1",
    aliases: ["_[EBE] Carrinho Abandonado1"],
    description: "Início de carrinho abandonado: marca tag e envia botão de carrinho.",
    steps: [
      { type: "stopIfHasAnyTag", label: "Encerrar se já pagou/recebeu", tags: paidOrReceivedTags },
      { type: "addTag", label: "Marcar etapa carrinho 2", tag: "[EBE] Pedido Carrinho Abandonado2" },
      { type: "sendButtons", label: "Enviar botão carrinho", template: buttonTemplates.carrinhoAbandonado1 },
      { type: "wait", label: "Aguardar 2s", seconds: 2 }
    ]
  },
  {
    id: "carrinhoAbandonado2",
    title: "Carrinho Abandonado 2",
    aliases: ["[EBE] Carrinho Abandonado2"],
    description: "Remove tag anterior e envia lembrete de carrinho.",
    steps: [
      { type: "removeTag", label: "Remover tag carrinho 2", tag: "[EBE] Pedido Carrinho Abandonado2" },
      { type: "stopIfHasAnyTag", label: "Encerrar se já pagou/recebeu", tags: paidOrReceivedTags },
      { type: "addTag", label: "Marcar etapa carrinho 3", tag: "[EBE] Pedido Carrinho Abandonado3" },
      { type: "sendText", label: "Enviar lembrete carrinho", text: textTemplates.carrinhoAbandonado2 }
    ]
  },
  {
    id: "carrinhoAbandonado3",
    title: "Carrinho Abandonado 3",
    aliases: ["[EBE] Carrinho Abandonado3"],
    description: "Última tentativa de carrinho abandonado.",
    steps: [
      { type: "stopIfHasAnyTag", label: "Encerrar se já pagou/recebeu", tags: paidOrReceivedTags },
      { type: "sendText", label: "Enviar último aviso", text: textTemplates.carrinhoAbandonado3 },
      { type: "sendText", label: "Mensagem extra", text: textTemplates.carrinhoAbandonado3Extra }
    ]
  }
];
