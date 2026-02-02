# Shot-tray ERP + Shotzap

Integrações de ERP com Shotzap usando templates e casos de uso estáticos, inspirados nos flows legados.

Importante: os flows não são lidos em tempo de execução. Eles serviram apenas como base de referência para recriar o comportamento no nosso formato. Você pode apagá-los sem afetar o funcionamento.

## Arquitetura

- `src/use-cases/cases/` contém casos de uso por domínio (carrinho, cancelado, recebido, pago, enviado, entregue).
- `src/use-cases/templates/` contém templates de mensagens (texto e botões).
- `src/use-cases/index.js` agrega todos os casos de uso.
- `src/use-cases/shotzapMessages.js` guarda os templates de mensagens.
- `src/flow-engine/templateRenderer.js` rendeiriza placeholders.
- `src/services/messageDispatcher.js` executa os casos de uso via API do Shotzap.
- `src/routes/webhooks.js` recebe eventos do ERP e dispara o fluxo correspondente.

## Visualização dos flows

`GET /flows` retorna um resumo dos casos de uso por flow.

## Setup

1. Copie `.env.example` para `.env` e preencha.
2. Instale dependências e execute:

- `npm install`
- `npm run dev`

## Endpoint de Webhook

`POST /webhooks/erp/:provider`

Headers:
- `x-erp-signature`: HMAC SHA-256 do body com `ERP_WEBHOOK_SECRET`.

Body (exemplo):

```
{
  "status": "pedido_pago",
  "customer": { "name": "Ana", "phone": "5511999999999" },
  "order": {
    "trackingUrl": "https://rastreamento",
    "itemsSummary": "Bíblia + Devocional"
  }
}
```

## Extensão rápida

Edite o mapeamento em [src/services/erpEventMapper.js](src/services/erpEventMapper.js) para suportar novos status e flows.

## Endpoints configuráveis

Os paths das chamadas Shotzap ficam em variáveis de ambiente:

- `SHOTZAP_SEND_BUTTONS_PATH`
- `SHOTZAP_SEND_TEXT_PATH`
- `SHOTZAP_TAG_ADD_PATH`
- `SHOTZAP_TAG_REMOVE_PATH`

Se sua API usar paths diferentes, ajuste no `.env`.

## Placeholders suportados

- `{{name}}`, `{{number}}`
- `%extra1%`, `%extra2%`, `%extra3%`
- `{nome}` (mapeado para `name`)

## Testes

- `npm test`
