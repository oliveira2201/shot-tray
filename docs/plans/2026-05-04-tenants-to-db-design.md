# Design — Tenants no DB + Admin CRUD + Tray OAuth real

**Data:** 2026-05-04
**Autor:** Felipe + Claude

## Problema

Hoje a configuração de tenants vive em `src/config/tenants.json` e tokens em env vars (`SHOTZAP_TOKEN_*`). Templates e flows ficam em `src/tenants/{id}/templates.json` e `flows/*.json`. Adicionar um novo tenant ou editar uma mensagem exige commit + deploy.

Com a Ótica Joá entrando (e mais tenants previstos), isso não escala. Precisamos:

- Criar/editar tenants pelo admin sem deploy
- Editar templates e flows pelo admin
- Suportar adapter Tray real (OAuth, lookup do pedido a partir do `scope_id` do webhook)
- Não desautenticar webhooks
- Não quebrar a Lumi nem desagendar jobs em andamento no Redis

## Decisões principais

| Decisão | Escolha |
|---|---|
| Tudo no DB ou misto? | **Tudo no DB** (config, templates, flows). Tags cache continua em arquivo. |
| Modelagem do adapter config | **JSONB no Tenant** (`adapterConfig`, `providerConfig`) + tabela separada `OAuthToken` para tokens com refresh automático |
| Auth do admin | **Zitadel OIDC** existente em `https://id.vexvendas.com.br` (mesmo IdP do VEX) |
| Webhooks têm auth? | **Não.** Continuam públicos com validação HMAC quando o ERP suporta |
| Migration | **Hard cutover via Prisma migration + seed idempotente.** 1 release com fallback opcional, depois remove arquivos |
| Tray webhook → flow | **Adapter real** que faz OAuth lookup. Cron 15min refresha tokens próximos do vencimento |

## Arquitetura

### Schema do banco

```prisma
model Tenant {
  id              String       @id           // "lumi", "oticajoa"
  name            String
  status          String       @default("active")  // active | disabled
  adapterType     String                          // "tray" | "nuvemshop" | "default"
  providerType    String                          // "shotzap"
  adapterConfig   Json                            // { apiAddress, baseUrl, paths, vars }
  providerConfig  Json                            // { baseUrl, token, paths, tagsCachePath }
  templates       Template[]
  flows           Flow[]
  oauthTokens     OAuthToken[]
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
}

model Template {
  id         String   @id @default(uuid())
  tenantId   String
  kind       String   // "text" | "buttons"
  key        String
  content    Json
  tenant     Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  @@unique([tenantId, kind, key])
}

model Flow {
  id          String   @id @default(uuid())
  tenantId    String
  slug        String
  title       String
  aliases     String[]
  description String
  steps       Json
  enabled     Boolean  @default(true)
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@unique([tenantId, slug])
}

model OAuthToken {
  id              String    @id @default(uuid())
  tenantId        String
  provider        String    // "tray"
  accessToken     String
  refreshToken    String?
  expiresAt       DateTime
  scope           String?
  lastRefreshAt   DateTime?
  refreshFailures Int       @default(0)
  tenant          Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@unique([tenantId, provider])
  @@index([expiresAt])
}
```

### Auth — Zitadel OIDC

- Application nova `Shot Tray Admin` no Zitadel (Web App, PKCE, sem client_secret)
- Issuer: `https://id.vexvendas.com.br`
- Frontend usa `oidc-client-ts`. Token em `sessionStorage`
- Backend middleware `requireAuth` valida JWT via `jose` + JWK do issuer
- Aplicado **só em `/api/admin/*`**. Webhooks ficam intocados

### Separação de zonas

| Zona | Rotas | Auth |
|---|---|---|
| Pública | `POST /webhooks/*`, `GET /health` | Nenhuma |
| SPA estático | `GET /`, `GET /builder/*` | Servidor não autentica (HTML estático). JS exige login Zitadel ao carregar |
| Admin API | `/api/admin/*` | JWT Zitadel obrigatório |

### Cliente Tray + adapter real

- `src/integrations/ecommerce/tray/client.ts`: `TrayClient(tenantId)` com métodos `getOrder(scopeId)`, `refreshToken()`. Usa `apiAddress` do `adapterConfig` e `accessToken` do `OAuthToken`
- `src/integrations/ecommerce/tray-adapter.ts`: recebe webhook minimal da Tray (`scope_name`, `scope_id`, `act`), faz lookup com `TrayClient`, monta `NormalizedEvent` com nome/telefone/status. Mapeia `order.status` → `flowAlias`
- Cron `setInterval(15min)` em `src/modules/scheduler/oauth-refresh.ts`: query `WHERE expires_at < now() + interval '1 hour'`, chama `client.refreshToken()` pra cada um. Após 3 falhas seguidas, marca tenant `disabled`

### Endpoints admin

- **Tenants:** `GET/POST/PUT/DELETE /api/admin/tenants[/:id]`, `GET /api/admin/adapters` (schema dinâmico do form)
- **Templates:** `GET/POST/DELETE /api/admin/tenants/:id/templates[/:key]`
- **Flows:** `GET/POST/DELETE /api/admin/tenants/:id/flows[/:slug]`
- **OAuth Tray:** `start`, `complete`, `refresh-now`, `status` em `/api/admin/tenants/:id/oauth/tray/*`
- Rotas existentes (`/api/tenants`, `/api/flows/...`, etc) movem todas pra `/api/admin/*`. Webhooks não mudam.

### Frontend

- `AuthGuard` envolvendo o app (redirect Zitadel sem token)
- `TenantList` (tabela + criar)
- `TenantDetail` com 4 abas: Config (form dinâmico por adapter), Templates, Flows (`FlowEditor` existente), OAuth Tray (só pra `adapterType === "tray"`)
- Páginas existentes (Dashboard, Monitor, History, Simulator) continuam, ganham contexto de tenant

## Fluxo de dados

```
[Tray]                           [Shot Tray]                          [Shotzap]
   |                                  |                                   |
   | POST /webhooks/oticajoa          |                                   |
   | { scope_name, scope_id, act }    |                                   |
   |--------------------------------->|                                   |
   |                                  | TrayAdapter.normalize()           |
   |                                  | ↓                                 |
   |                                  | TrayClient.getOrder(scope_id)     |
   |<---------------------------------|                                   |
   | (order completo)                 |                                   |
   |--------------------------------->|                                   |
   |                                  | NormalizedEvent → runUseCase      |
   |                                  | (templates/flows do DB)           |
   |                                  | ShotzapProvider.send*             |
   |                                  |---------------------------------->|
```

## Migration & cutover

1. Prisma migration cria tabelas
2. Seed `scripts/seed-tenants-from-files.ts` (idempotente) lê arquivos atuais e popula DB. Roda no `docker-entrypoint.sh`
3. `TenantService` refatorado lê do DB com cache 30s
4. **Release 1 (silencioso):** deploy com fallback "se DB vazio, usa arquivo + warn"
5. Validação 1-2 dias em produção
6. **Release 2 (cutover):** remove fallback, deleta `tenants.json` e env vars de token
7. Cadastra OAuth Tray da Ótica Joá pelo admin

## Preservação de jobs agendados

- Migration **não renomeia nada** — IDs/keys/aliases mantidos
- `remainingSteps` no Redis ficam intocados. Quando job roda, `templateKey` resolve via DB com mesmo nome
- Choice listeners idem (já têm restore do Redis após restart)
- Antes do cutover: lista jobs pendentes e confere que nenhum referencia algo que vai mudar

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Seed falha no deploy | `migrate deploy` roda primeiro; seed loga e tolera erros parciais |
| Cache em memória stale após edit na UI | Invalidação explícita (`TenantService.invalidate(tenantId)`) |
| Job agendado tenta template renomeado | Migration mantém keys idênticas |
| Token OAuth Tray expira, refresh falha 3x | Tenant marcado `disabled` + alerta. Admin reconecta pela UI |
| Zitadel cai | Webhooks continuam funcionando. Só admin não loga |
| Webhook acidentalmente protegido por auth | Middleware aplicado apenas em `/api/admin/*`, registrado depois das rotas públicas |

## Não escopo (YAGNI agora)

- Multi-usuário com roles (Zitadel suporta, fica pra depois)
- Histórico de revisões de templates/flows (tabelas `_revisions`)
- Outros adapters OAuth (Mercado Livre, Magalu) — esquema já cobre, mas não implementar agora
- Tags cache no DB
- Audit log de ações admin
