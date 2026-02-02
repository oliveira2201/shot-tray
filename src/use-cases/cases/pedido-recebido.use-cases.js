import { buttonTemplates, textTemplates } from "../templates/index.js";

const conflictTags = [
  "[EBE] Pedido Enviado",
  "[EBE] Pedido Cancelado1",
  "[EBE] Pedido Cancelado2",
  "[EBE] Pedido Cancelado3",
  "[EBE] Pedido Carrinho Abandonado1",
  "[EBE] Pedido Carrinho Abandonado2",
  "[EBE] Pedido Carrinho Abandonado3"
];

const receivedTags = [
  "[EBE] Pedido Recebido",
  "[EBE] Pedido Recebido1",
  "[EBE] Pedido Recebido2",
  "[EBE] Pedido Recebido3"
];

const createRemoveSteps = (tags) => tags.map(tag => ({ type: "removeTag", label: `Limpar ${tag}`, tag }));

export const pedidoRecebidoUseCases = [
  {
    id: "pedidoRecebido",
    title: "Pedido Recebido",
    aliases: ["[EBE] Pedido Recebido"],
    description: "Fluxo principal após pedido recebido.",
    steps: [
      { type: "addTag", label: "Marcar etapa recebido 1", tag: "[EBE] Pedido Recebido1" },
      ...createRemoveSteps(conflictTags),
      { type: "wait", label: "Aguardar 120s", seconds: 120 },
      { type: "stopIfHasAnyTag", label: "Encerrar se pagou", tags: ["[EBE] Pedido Pago"] },
      ...createRemoveSteps(receivedTags),
      { type: "sendText", label: "Mensagem teste", text: textTemplates.pedidoRecebidoTeste },
      { type: "sendButtons", label: "Enviar botão rastreio", template: buttonTemplates.pedidoRecebido },
      { type: "sendButtons", label: "Enviar quick replies", template: buttonTemplates.pedidoRecebidoQuickReply },
      { type: "wait", label: "Aguardar 2s", seconds: 2 },
      { 
        type: "conditionalChoice", 
        label: "Tratar escolha do cliente",
        conditions: [
          { match: "descadastre", responseTemplate: textTemplates.pedidoRecebidoDescadastre },
          { match: "rastrear", responseTemplate: textTemplates.pedidoRecebidoRastrear }
        ],
        defaultTemplate: textTemplates.pedidoRecebidoSelecione
      }
    ]
  },
  {
    id: "pedidoRecebido1",
    title: "Pedido Recebido 1",
    aliases: ["[EBE] Pedido Recebido1"],
    description: "Primeira cobrança de pagamento.",
    steps: [
      { type: "addTag", label: "Marcar etapa recebido 2", tag: "[EBE] Pedido Recebido2" },
      ...createRemoveSteps(conflictTags),
      { type: "removeTag", label: "Limpar Recebido", tag: "[EBE] Pedido Recebido" },
      { type: "stopIfHasAnyTag", label: "Encerrar se pagou", tags: ["[EBE] Pedido Pago"] },
      { type: "sendText", label: "Cobrança 1", text: textTemplates.pedidoRecebido1 }
    ]
  },
  {
    id: "pedidoRecebido2",
    title: "Pedido Recebido 2",
    aliases: ["[EBE] Pedido Recebido2"],
    description: "Segunda cobrança de pagamento.",
    steps: [
      { type: "addTag", label: "Marcar etapa recebido 3", tag: "[EBE] Pedido Recebido3" },
      ...createRemoveSteps(conflictTags),
      { type: "removeTag", label: "Limpar Recebido2", tag: "[EBE] Pedido Recebido2" },
      { type: "stopIfHasAnyTag", label: "Encerrar se pagou", tags: ["[EBE] Pedido Pago"] },
      { type: "sendText", label: "Cobrança 2", text: textTemplates.pedidoRecebido2 }
    ]
  },
  {
    id: "pedidoRecebido3",
    title: "Pedido Recebido 3",
    aliases: ["[EBE] Pedido Recebido3"],
    description: "Terceira cobrança de pagamento.",
    steps: [
      { type: "addTag", label: "Manter recebido 3", tag: "[EBE] Pedido Recebido3" },
      ...createRemoveSteps(conflictTags),
      { type: "removeTag", label: "Limpar Recebido2", tag: "[EBE] Pedido Recebido2" },
      { type: "stopIfHasAnyTag", label: "Encerrar se pagou", tags: ["[EBE] Pedido Pago"] },
      { type: "sendText", label: "Cobrança 3", text: textTemplates.pedidoRecebido3 }
    ]
  }
];
