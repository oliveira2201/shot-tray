import { buttonTemplates, textTemplates } from "../templates/index.js";

export const pedidoRecebidoUseCases = [
  {
    id: "pedidoRecebido",
    title: "Pedido Recebido",
    aliases: ["[EBE] Pedido Recebido"],
    description: "Fluxo principal após pedido recebido.",
    steps: [
      { type: "addTag", label: "Marcar etapa recebido 1", tag: "[EBE] Pedido Recebido1" },
      { type: "removeTag", label: "Limpar Enviado", tag: "[EBE] Pedido Enviado" },
      { type: "removeTag", label: "Limpar Cancelado1", tag: "[EBE] Pedido Cancelado1" },
      { type: "removeTag", label: "Limpar Cancelado2", tag: "[EBE] Pedido Cancelado2" },
      { type: "removeTag", label: "Limpar Cancelado3", tag: "[EBE] Pedido Cancelado3" },
      { type: "removeTag", label: "Limpar Carrinho1", tag: "[EBE] Pedido Carrinho Abandonado1" },
      { type: "removeTag", label: "Limpar Carrinho2", tag: "[EBE] Pedido Carrinho Abandonado2" },
      { type: "removeTag", label: "Limpar Carrinho3", tag: "[EBE] Pedido Carrinho Abandonado3" },
      { type: "wait", label: "Aguardar 120s", seconds: 120 },
      { type: "stopIfHasAnyTag", label: "Encerrar se pagou", tags: ["[EBE] Pedido Pago"] },
      { type: "removeTag", label: "Limpar Recebido", tag: "[EBE] Pedido Recebido" },
      { type: "removeTag", label: "Limpar Recebido1", tag: "[EBE] Pedido Recebido1" },
      { type: "removeTag", label: "Limpar Recebido2", tag: "[EBE] Pedido Recebido2" },
      { type: "removeTag", label: "Limpar Recebido3", tag: "[EBE] Pedido Recebido3" },
      { type: "sendText", label: "Mensagem teste", text: textTemplates.pedidoRecebidoTeste },
      { type: "sendButtons", label: "Enviar botão rastreio", template: buttonTemplates.pedidoRecebido },
      { type: "sendButtons", label: "Enviar quick replies", template: buttonTemplates.pedidoRecebidoQuickReply },
      { type: "wait", label: "Aguardar 2s", seconds: 2 },
      { type: "conditionalChoice", label: "Tratar escolha do cliente" }
    ]
  },
  {
    id: "pedidoRecebido1",
    title: "Pedido Recebido 1",
    aliases: ["[EBE] Pedido Recebido1"],
    description: "Primeira cobrança de pagamento.",
    steps: [
      { type: "addTag", label: "Marcar etapa recebido 2", tag: "[EBE] Pedido Recebido2" },
      { type: "removeTag", label: "Limpar Enviado", tag: "[EBE] Pedido Enviado" },
      { type: "removeTag", label: "Limpar Cancelado1", tag: "[EBE] Pedido Cancelado1" },
      { type: "removeTag", label: "Limpar Cancelado2", tag: "[EBE] Pedido Cancelado2" },
      { type: "removeTag", label: "Limpar Cancelado3", tag: "[EBE] Pedido Cancelado3" },
      { type: "removeTag", label: "Limpar Carrinho 1 (nome antigo)", tag: "[EBE] Carrinho Abandonado 1" },
      { type: "removeTag", label: "Limpar Carrinho2", tag: "[EBE] Pedido Carrinho Abandonado2" },
      { type: "removeTag", label: "Limpar Carrinho3", tag: "[EBE] Pedido Carrinho Abandonado3" },
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
      { type: "removeTag", label: "Limpar Enviado", tag: "[EBE] Pedido Enviado" },
      { type: "removeTag", label: "Limpar Cancelado1", tag: "[EBE] Pedido Cancelado1" },
      { type: "removeTag", label: "Limpar Cancelado2", tag: "[EBE] Pedido Cancelado2" },
      { type: "removeTag", label: "Limpar Cancelado3", tag: "[EBE] Pedido Cancelado3" },
      { type: "removeTag", label: "Limpar Carrinho1", tag: "[EBE] Pedido Carrinho Abandonado1" },
      { type: "removeTag", label: "Limpar Carrinho2", tag: "[EBE] Pedido Carrinho Abandonado2" },
      { type: "removeTag", label: "Limpar Carrinho3", tag: "[EBE] Pedido Carrinho Abandonado3" },
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
      { type: "removeTag", label: "Limpar Enviado", tag: "[EBE] Pedido Enviado" },
      { type: "removeTag", label: "Limpar Cancelado1", tag: "[EBE] Pedido Cancelado1" },
      { type: "removeTag", label: "Limpar Cancelado2", tag: "[EBE] Pedido Cancelado2" },
      { type: "removeTag", label: "Limpar Cancelado3", tag: "[EBE] Pedido Cancelado3" },
      { type: "removeTag", label: "Limpar Carrinho1", tag: "[EBE] Pedido Carrinho Abandonado1" },
      { type: "removeTag", label: "Limpar Carrinho2", tag: "[EBE] Pedido Carrinho Abandonado2" },
      { type: "removeTag", label: "Limpar Carrinho3", tag: "[EBE] Pedido Carrinho Abandonado3" },
      { type: "removeTag", label: "Limpar Recebido2", tag: "[EBE] Pedido Recebido2" },
      { type: "stopIfHasAnyTag", label: "Encerrar se pagou", tags: ["[EBE] Pedido Pago"] },
      { type: "sendText", label: "Cobrança 3", text: textTemplates.pedidoRecebido3 }
    ]
  }
];
