export const buttonTemplates = {
  carrinhoAbandonado1: {
    openTicket: 0,
    body: [
      {
        phone: "{{number}}",
        title: "👋Graça e Paz {{name}}! 🙏",
        body: "Vi que você deixou umas bênçãos te esperando no carrinho da nossa loja! 📖✨\nMas corre, viu?\n\n*{{extra3}}* têm estoque limitado e pode acabar rapidinho! 🏃‍♀️💨\n\nAcesse agora mesmo seu carrinho e garanta sua bênção",
        footer: "Clique para acessar seu carrinho",
        buttons: [
          {
            type: "url",
            text: "Acessar Carrinho",
            url: "https://4soci.al/carrinhoebenezer"
          }
        ]
      }
    ]
  },
  pedidoPago: {
    openTicket: 0,
    body: [
      {
        phone: "{{number}}",
        title: "🕊️🎉 *Trago boas novas {{name}}* 🕊️🎉",
        body: "Que benção! Acabei de receber a confirmação do seu pagamento ✅\n\nJá estou enviando ele para separação e envio, assim que ele for despachado te aviso.\n\nQualquer dúvida é só me chamar ok? 😊\nFique Com Deus!",
        buttons: [
          {
            type: "url",
            text: "Rastrear Pedido",
            url: "{{extra1}}"
          }
        ]
      }
    ]
  },
  pedidoRecebido: {
    openTicket: 0,
    body: [
      {
        phone: "{{number}}",
        title: "👋 A Paz {{name}}",
        body: "Obrigado por comprar na *Ebenézer*, Deus te abençoe 😊\nRecebemos seu pedido e assim que o pagamento for confirmado, ele segue para separação e envio, vou continuar te avisando por aqui.\n\nEnquanto isso, aproveite e salve meu contato para garantir que vai receber minhas mensagens.\n\nSe precisar você também pode verificar o status do seu pedido ou até mesmo gerar o boleto caso não tenha gerado ainda no link abaixo 👇",
        footer: "",
        buttons: [
          {
            type: "url",
            text: "Rastrear Pedido",
            url: "{{extra1}}"
          }
        ]
      }
    ]
  },
  pedidoRecebidoQuickReply: {
    openTicket: 0,
    body: [
      {
        phone: "{{number}}",
        title: "👋 A Paz {{name}}",
        body: "Obrigado por comprar na *Ebenézer*, Deus te abençoe 😊\nRecebemos seu pedido e assim que o pagamento for confirmado, ele segue para separação e envio, vou continuar te avisando por aqui.\nEnquanto isso, aproveite e salve meu contato para garantir que vai receber minhas mensagens.\nSe precisar você também pode verificar o status do seu pedido ou até mesmo gerar o boleto caso não tenha gerado ainda no link abaixo 👇",
        footer: "Selecione uma opção",
        buttons: [
          { type: "quickreply", text: "Rastrear Pedido", value: "Rastrear Pedido" },
          { type: "quickreply", text: "Me Descadastre", value: "Me Descadastre" }
        ]
      }
    ]
  },
  pedidoEnviadoTracking: {
    openTicket: 0,
    body: [
      {
        phone: "{{number}}",
        title: "🚚 *Seu pedido já está pronto {{name}}* 🚚",
        body: "Se você optou por retirar aqui em nossa loja, *aguarde por favor o contato do SAC,* e se você optou pela entrega via transportadora ou correios, agora é só acompanhar a entrega, *se certifique que vai ter alguém no endereço para poder receber seu pedido.*\n\nPara rastrear a entrega acesse sua conta no nosso site pelo link\n😉 Te mandei também por e-mail os dados para vc poder rastrear a entrega.\nQualquer dúvida é só me chamar ok?\nAté mais.",
        footer: "",
        buttons: [
          {
            type: "url",
            text: "Rastrear Pedido",
            url: "{{extra1}}"
          }
        ]
      }
    ]
  },
  pedidoEnviadoVip: {
    openTicket: 0,
    body: [
      {
        phone: "{{number}}",
        title: "😳 Já ia me esquecendo {{name}}",
        body: "Você conhece nosso grupo VIP de promoções?👑\n\nÉ um grupo de WhatsApp onde eu envio as melhores promoções para clientes VIP como você.\nE não se preocupe que é um grupo silenciado que só eu envio mensagens lá.\n\nQualquer dúvida é só me chamar.\n\nAté mais.\n\nVamos manter contato, clique no link e faça parte do grupo VIP 👇",
        footer: "",
        buttons: [
          {
            type: "url",
            text: "Grupo VIP Ebenezer",
            url: "https://4soci.al/grupovip-ebenezer"
          }
        ]
      }
    ]
  },
  pedidoEntregueVip: {
    openTicket: 0,
    body: [
      {
        phone: "{{number}}",
        title: "Você já entrou no nosso Grupo VIP {{name}}?",
        body: "Não sei se você sabe, temos um grupo  VIP de promoções.\n\nÉ um grupo de WhatsApp onde eu envio as melhores promoções para clientes VIP como você.\nE não se preocupe que é um grupo silenciado que só eu envio mensagens lá.\n\nQualquer dúvida é só me chamar.\n\nAté mais.\n\nClique no link e faça parte do grupo VIP 👇",
        footer: "",
        buttons: [
          {
            type: "url",
            text: "Grupo VIP Ebenezer",
            url: "https://4soci.al/grupovip-ebenezer"
          }
        ]
      }
    ]
  }
};
