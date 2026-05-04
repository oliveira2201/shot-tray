# Tenants to DB Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrar configuração de tenants (config + templates + flows) de arquivos para Postgres, com CRUD via admin frontend autenticado por Zitadel, e implementar adapter Tray real com OAuth.

**Architecture:** Schema Prisma com `Tenant` (config como JSONB), `Template`, `Flow`, `OAuthToken`. Seed idempotente migra arquivos para o DB. `TenantService` lê do DB com cache 30s e fallback de arquivo durante a primeira release. Rotas admin protegidas por middleware Zitadel JWT (`/api/admin/*`); webhooks ficam públicos. Adapter Tray faz OAuth lookup; cron de 15min renova tokens próximos do vencimento.

**Tech Stack:** Node 20 + Express + TypeScript, Prisma 7 + Postgres 16, Redis (ioredis), React + Vite + Tailwind, Zitadel OIDC, `jose` (JWT), `oidc-client-ts` (frontend), `axios`.

**Reference design:** `docs/plans/2026-05-04-tenants-to-db-design.md`

**Critical safety rules:**
- Webhooks (`POST /webhooks/:tenantId`) NUNCA recebem auth nesta refatoração
- IDs/keys/aliases de tenants/flows/templates **não podem mudar** (jobs no Redis dependem deles)
- Lumi precisa continuar funcionando o tempo todo

---

## Phase 1 — Schema + Seed (Release 1, parte A)

### Task 1: Adicionar models Prisma

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Adicionar models ao schema**

Adicionar ao final do arquivo:

```prisma
model Tenant {
  id              String       @id
  name            String
  status          String       @default("active")
  adapterType     String       @map("adapter_type")
  providerType    String       @map("provider_type")
  adapterConfig   Json         @default("{}") @map("adapter_config")
  providerConfig  Json         @default("{}") @map("provider_config")
  templates       Template[]
  flows           Flow[]
  oauthTokens     OAuthToken[]
  createdAt       DateTime     @default(now()) @map("created_at")
  updatedAt       DateTime     @updatedAt @map("updated_at")

  @@map("tenants")
}

model Template {
  id         String   @id @default(uuid())
  tenantId   String   @map("tenant_id")
  kind       String
  key        String
  content    Json
  tenant     Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  @@unique([tenantId, kind, key])
  @@map("templates")
}

model Flow {
  id          String   @id @default(uuid())
  tenantId    String   @map("tenant_id")
  slug        String
  title       String
  aliases     String[]
  description String   @default("")
  steps       Json
  enabled     Boolean  @default(true)
  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@unique([tenantId, slug])
  @@map("flows")
}

model OAuthToken {
  id              String    @id @default(uuid())
  tenantId        String    @map("tenant_id")
  provider        String
  accessToken     String    @map("access_token")
  refreshToken    String?   @map("refresh_token")
  expiresAt       DateTime  @map("expires_at")
  scope           String?
  lastRefreshAt   DateTime? @map("last_refresh_at")
  refreshFailures Int       @default(0) @map("refresh_failures")
  tenant          Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, provider])
  @@index([expiresAt])
  @@map("oauth_tokens")
}
```

**Step 2: Criar migration manual (Prisma 7 no Windows tem bug com schema engine)**

Criar `prisma/migrations/20260504_tenants_db/migration.sql` com SQL equivalente:

```sql
CREATE TABLE "tenants" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "adapter_type" TEXT NOT NULL,
  "provider_type" TEXT NOT NULL,
  "adapter_config" JSONB NOT NULL DEFAULT '{}',
  "provider_config" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "templates" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "kind" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("tenant_id", "kind", "key")
);

CREATE TABLE "flows" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "aliases" TEXT[] NOT NULL DEFAULT '{}',
  "description" TEXT NOT NULL DEFAULT '',
  "steps" JSONB NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("tenant_id", "slug")
);

CREATE TABLE "oauth_tokens" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "provider" TEXT NOT NULL,
  "access_token" TEXT NOT NULL,
  "refresh_token" TEXT,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "scope" TEXT,
  "last_refresh_at" TIMESTAMPTZ,
  "refresh_failures" INTEGER NOT NULL DEFAULT 0,
  UNIQUE ("tenant_id", "provider")
);

CREATE INDEX "oauth_tokens_expires_at_idx" ON "oauth_tokens"("expires_at");
```

**Step 3: Aplicar migration localmente**

```bash
docker exec infra-postgres psql -U postgres -d shot_tray_db -f - < prisma/migrations/20260504_tenants_db/migration.sql
```

Esperado: `CREATE TABLE` x4, `CREATE INDEX` x1.

**Step 4: Gerar Prisma client**

```bash
cd c:/projetos/shot-tray && npx prisma generate
```

Esperado: `✔ Generated Prisma Client`.

**Step 5: Verificar TypeScript compila**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

**Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260504_tenants_db/
git commit -m "feat(db): add Tenant/Template/Flow/OAuthToken models"
```

---

### Task 2: TenantRepository (DB-first com fallback de arquivo)

**Files:**
- Create: `src/lib/repositories/tenant-repository.ts`
- Create: `tests/tenant-repository.test.ts`

**Step 1: Escrever teste de fallback (TDD)**

```typescript
// tests/tenant-repository.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../src/lib/prisma.js", () => ({
  getPrisma: async () => ({
    tenant: { findUnique: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
    template: { findMany: vi.fn().mockResolvedValue([]) },
    flow: { findMany: vi.fn().mockResolvedValue([]) },
  }),
}));

import { TenantRepository } from "../src/lib/repositories/tenant-repository.js";

describe("TenantRepository", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna null quando tenant nao existe no DB e fallback desabilitado", async () => {
    const repo = new TenantRepository({ fallbackToFiles: false });
    const result = await repo.findById("inexistente");
    expect(result).toBeNull();
  });

  it("retorna tenant do arquivo quando DB vazio e fallback habilitado", async () => {
    const repo = new TenantRepository({ fallbackToFiles: true });
    const result = await repo.findById("lumi");
    expect(result?.id).toBe("lumi");
    expect(result?.adapterType).toBe("nuvemshop");
  });
});
```

**Step 2: Rodar teste e ver falhar**

```bash
npx vitest run tests/tenant-repository.test.ts
```

Esperado: falha (módulo não existe).

**Step 3: Implementar repository**

```typescript
// src/lib/repositories/tenant-repository.ts
import fs from "fs/promises";
import path from "path";
import { getPrisma } from "../prisma.js";
import { logger } from "../../utils/logger.js";

export interface TenantRecord {
  id: string;
  name: string;
  status: string;
  adapterType: string;
  providerType: string;
  adapterConfig: any;
  providerConfig: any;
}

export interface TemplateRecord {
  tenantId: string;
  kind: "text" | "buttons";
  key: string;
  content: any;
}

export interface FlowRecord {
  tenantId: string;
  slug: string;
  title: string;
  aliases: string[];
  description: string;
  steps: any[];
  enabled: boolean;
}

interface RepoOptions {
  fallbackToFiles?: boolean;
}

export class TenantRepository {
  constructor(private opts: RepoOptions = { fallbackToFiles: true }) {}

  async findById(id: string): Promise<TenantRecord | null> {
    try {
      const db = await getPrisma();
      const row = await db.tenant.findUnique({ where: { id } });
      if (row) return row as TenantRecord;
    } catch (err: any) {
      logger.warn({ err: err.message, tenantId: id }, "Falha ao buscar tenant no DB");
    }

    if (!this.opts.fallbackToFiles) return null;
    return this._loadTenantFromFile(id);
  }

  async list(): Promise<TenantRecord[]> {
    try {
      const db = await getPrisma();
      const rows = await db.tenant.findMany({ orderBy: { id: "asc" } });
      if (rows.length > 0) return rows as TenantRecord[];
    } catch (err: any) {
      logger.warn({ err: err.message }, "Falha ao listar tenants no DB");
    }

    if (!this.opts.fallbackToFiles) return [];
    return this._loadAllTenantsFromFile();
  }

  async listTemplates(tenantId: string): Promise<TemplateRecord[]> {
    try {
      const db = await getPrisma();
      const rows = await db.template.findMany({ where: { tenantId } });
      if (rows.length > 0) return rows as TemplateRecord[];
    } catch (err: any) {
      logger.warn({ err: err.message, tenantId }, "Falha ao listar templates");
    }

    if (!this.opts.fallbackToFiles) return [];
    return this._loadTemplatesFromFile(tenantId);
  }

  async listFlows(tenantId: string): Promise<FlowRecord[]> {
    try {
      const db = await getPrisma();
      const rows = await db.flow.findMany({ where: { tenantId } });
      if (rows.length > 0) return rows as FlowRecord[];
    } catch (err: any) {
      logger.warn({ err: err.message, tenantId }, "Falha ao listar flows");
    }

    if (!this.opts.fallbackToFiles) return [];
    return this._loadFlowsFromFile(tenantId);
  }

  // --- Fallback de arquivo ---

  private async _loadTenantFromFile(id: string): Promise<TenantRecord | null> {
    const all = await this._loadAllTenantsFromFile();
    return all.find(t => t.id === id) || null;
  }

  private async _loadAllTenantsFromFile(): Promise<TenantRecord[]> {
    try {
      const jsonPath = path.join(process.cwd(), "src", "config", "tenants.json");
      const raw = await fs.readFile(jsonPath, "utf-8");
      const list = JSON.parse(raw);
      return list
        .filter((t: any) => !t.disabled)
        .map((t: any) => ({
          id: t.id,
          name: t.name,
          status: t.disabled ? "disabled" : "active",
          adapterType: t.inputAdapter,
          providerType: t.outputProvider,
          adapterConfig: { vars: t.config?.vars || {} },
          providerConfig: {
            baseUrl: t.config?.baseUrl,
            token: (t.config?.tokenEnv && process.env[t.config.tokenEnv]) || t.config?.token,
            paths: t.config?.paths || {},
            tagsCachePath: t.config?.tagsCachePath,
          },
        }));
    } catch (err: any) {
      logger.warn({ err: err.message }, "Falha no fallback de tenants.json");
      return [];
    }
  }

  private async _loadTemplatesFromFile(tenantId: string): Promise<TemplateRecord[]> {
    try {
      const jsonPath = path.join(process.cwd(), "src", "tenants", tenantId, "templates.json");
      const raw = await fs.readFile(jsonPath, "utf-8");
      const parsed = JSON.parse(raw);
      const out: TemplateRecord[] = [];
      for (const [key, content] of Object.entries(parsed.text || {})) {
        out.push({ tenantId, kind: "text", key, content });
      }
      for (const [key, content] of Object.entries(parsed.buttons || {})) {
        out.push({ tenantId, kind: "buttons", key, content });
      }
      return out;
    } catch {
      return [];
    }
  }

  private async _loadFlowsFromFile(tenantId: string): Promise<FlowRecord[]> {
    try {
      const dir = path.join(process.cwd(), "src", "tenants", tenantId, "flows");
      const files = await fs.readdir(dir);
      const out: FlowRecord[] = [];
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const raw = await fs.readFile(path.join(dir, file), "utf-8");
        const parsed = JSON.parse(raw);
        out.push({
          tenantId,
          slug: file.replace(".json", ""),
          title: parsed.title,
          aliases: parsed.aliases || [],
          description: parsed.description || "",
          steps: parsed.steps,
          enabled: true,
        });
      }
      return out;
    } catch {
      return [];
    }
  }
}
```

**Step 4: Rodar teste e ver passar**

```bash
npx vitest run tests/tenant-repository.test.ts
```

Esperado: 2 PASS.

**Step 5: Commit**

```bash
git add src/lib/repositories/tenant-repository.ts tests/tenant-repository.test.ts
git commit -m "feat(repo): TenantRepository with DB-first + file fallback"
```

---

### Task 3: Script de seed idempotente

**Files:**
- Create: `scripts/seed-tenants-from-files.ts`

**Step 1: Implementar seed**

```typescript
// scripts/seed-tenants-from-files.ts
import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { getPrisma } from "../src/lib/prisma.js";
import { logger } from "../src/utils/logger.js";

async function main() {
  const db = await getPrisma();
  const tenantsPath = path.join(process.cwd(), "src", "config", "tenants.json");

  let tenantsRaw: any[];
  try {
    const raw = await fs.readFile(tenantsPath, "utf-8");
    tenantsRaw = JSON.parse(raw);
  } catch (err: any) {
    logger.warn({ err: err.message }, "tenants.json não encontrado, seed pulado");
    return;
  }

  for (const t of tenantsRaw) {
    if (t.disabled) {
      logger.info({ id: t.id }, "Tenant disabled, pulando");
      continue;
    }

    const token = (t.config?.tokenEnv && process.env[t.config.tokenEnv]) || t.config?.token;
    if (!token) {
      logger.warn({ id: t.id, env: t.config?.tokenEnv }, "Token não disponível, seed do tenant pulado");
      continue;
    }

    await db.tenant.upsert({
      where: { id: t.id },
      create: {
        id: t.id,
        name: t.name,
        status: "active",
        adapterType: t.inputAdapter,
        providerType: t.outputProvider,
        adapterConfig: { vars: t.config?.vars || {} },
        providerConfig: {
          baseUrl: t.config.baseUrl,
          token,
          paths: t.config.paths || {},
          tagsCachePath: t.config.tagsCachePath,
        },
      },
      update: {
        name: t.name,
        adapterType: t.inputAdapter,
        providerType: t.outputProvider,
        adapterConfig: { vars: t.config?.vars || {} },
        providerConfig: {
          baseUrl: t.config.baseUrl,
          token,
          paths: t.config.paths || {},
          tagsCachePath: t.config.tagsCachePath,
        },
      },
    });
    logger.info({ id: t.id }, "Tenant upserted");

    // Templates
    try {
      const templatesPath = path.join(process.cwd(), "src", "tenants", t.id, "templates.json");
      const raw = await fs.readFile(templatesPath, "utf-8");
      const parsed = JSON.parse(raw);
      for (const [key, content] of Object.entries(parsed.text || {})) {
        await db.template.upsert({
          where: { tenantId_kind_key: { tenantId: t.id, kind: "text", key } },
          create: { tenantId: t.id, kind: "text", key, content: content as any },
          update: { content: content as any },
        });
      }
      for (const [key, content] of Object.entries(parsed.buttons || {})) {
        await db.template.upsert({
          where: { tenantId_kind_key: { tenantId: t.id, kind: "buttons", key } },
          create: { tenantId: t.id, kind: "buttons", key, content: content as any },
          update: { content: content as any },
        });
      }
      logger.info({ tenantId: t.id, count: Object.keys(parsed.text || {}).length + Object.keys(parsed.buttons || {}).length }, "Templates upserted");
    } catch (err: any) {
      logger.warn({ err: err.message, tenantId: t.id }, "Templates não importados");
    }

    // Flows
    try {
      const flowsDir = path.join(process.cwd(), "src", "tenants", t.id, "flows");
      const files = await fs.readdir(flowsDir);
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const raw = await fs.readFile(path.join(flowsDir, file), "utf-8");
        const parsed = JSON.parse(raw);
        const slug = file.replace(".json", "");
        await db.flow.upsert({
          where: { tenantId_slug: { tenantId: t.id, slug } },
          create: {
            tenantId: t.id,
            slug,
            title: parsed.title,
            aliases: parsed.aliases || [],
            description: parsed.description || "",
            steps: parsed.steps,
            enabled: true,
          },
          update: {
            title: parsed.title,
            aliases: parsed.aliases || [],
            description: parsed.description || "",
            steps: parsed.steps,
          },
        });
      }
      logger.info({ tenantId: t.id, count: files.filter(f => f.endsWith(".json")).length }, "Flows upserted");
    } catch (err: any) {
      logger.warn({ err: err.message, tenantId: t.id }, "Flows não importados");
    }
  }

  logger.info("Seed completo");
}

main()
  .catch(err => {
    logger.error({ err: err.message }, "Seed falhou");
    process.exit(1);
  })
  .then(() => process.exit(0));
```

**Step 2: Adicionar script ao package.json**

Modificar `package.json`:

```json
"scripts": {
  "dev": "ts-node src/server.ts",
  "start": "ts-node src/server.ts",
  "build": "tsc",
  "test": "vitest run",
  "seed": "tsx scripts/seed-tenants-from-files.ts"
}
```

**Step 3: Rodar seed local e validar**

```bash
npm run seed
```

Esperado:
- `Tenant upserted` para `lumi` e `oticajoa`
- `Templates upserted count=...`
- `Flows upserted count=6`
- `Seed completo`

**Step 4: Validar dados no DB**

```bash
docker exec infra-postgres psql -U postgres -d shot_tray_db -c "SELECT id, name, adapter_type, provider_type FROM tenants;"
docker exec infra-postgres psql -U postgres -d shot_tray_db -c "SELECT tenant_id, kind, key FROM templates ORDER BY tenant_id, kind, key;"
docker exec infra-postgres psql -U postgres -d shot_tray_db -c "SELECT tenant_id, slug, aliases FROM flows ORDER BY tenant_id, slug;"
```

Esperado: lumi e oticajoa, todos os templates e 6 flows por tenant.

**Step 5: Rodar seed de novo (testar idempotência)**

```bash
npm run seed
```

Esperado: roda sem erro, dados não duplicam.

**Step 6: Commit**

```bash
git add scripts/seed-tenants-from-files.ts package.json
git commit -m "feat(seed): idempotent seed of tenants/templates/flows from files"
```

---

### Task 4: Plugar seed no docker-entrypoint

**Files:**
- Modify: `docker-entrypoint.sh`
- Modify: `Dockerfile`

**Step 1: Editar docker-entrypoint.sh**

```sh
#!/bin/sh
set -e

if [ -z "${DATABASE_URL:-}" ]; then
  echo "WARNING: DATABASE_URL not set, skipping migrations"
else
  if [ -d "./prisma/migrations" ]; then
    echo "Running Prisma migrations..."
    npx prisma migrate deploy || echo "WARNING: Migration failed"
  fi

  if [ "${SKIP_SEED:-}" != "1" ]; then
    echo "Running tenant seed..."
    npx tsx scripts/seed-tenants-from-files.ts || echo "WARNING: Seed failed (non-blocking)"
  fi
fi

exec node dist/server.js
```

**Step 2: Garantir que tsx está disponível no runner**

Modificar `Dockerfile` no stage `runner`:

```dockerfile
COPY --from=builder /app/scripts/ ./scripts/
```

Adicionar logo depois de `COPY --from=builder /app/prisma.config.ts ./`.

**Step 3: Validar build do Docker localmente (opcional, demora)**

Pular se não quiser esperar — esse passo é validado em produção no deploy.

**Step 4: Commit**

```bash
git add docker-entrypoint.sh Dockerfile
git commit -m "feat(deploy): run tenant seed on container start"
```

---

## Phase 2 — TenantService usa DB (Release 1, parte B)

### Task 5: Refatorar TenantService

**Files:**
- Modify: `src/services/tenantService.ts`
- Create: `tests/tenantService.test.ts`

**Step 1: Escrever teste de cache + invalidação**

```typescript
// tests/tenantService.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { TenantService } from "../src/services/tenantService.js";

describe("TenantService", () => {
  beforeEach(() => TenantService.invalidateAll());

  it("retorna null para tenant inexistente", async () => {
    const cfg = await TenantService.getTenantConfig("naoexiste");
    expect(cfg).toBeNull();
  });

  it("retorna config de lumi via fallback de arquivo", async () => {
    const cfg = await TenantService.getTenantConfig("lumi");
    expect(cfg?.id).toBe("lumi");
    expect(cfg?.provider).toBeDefined();
    expect(cfg?.templates).toBeDefined();
    expect(typeof cfg?.templates).toBe("object");
  });

  it("invalida cache do tenant especifico", async () => {
    await TenantService.getTenantConfig("lumi");
    TenantService.invalidate("lumi");
    // Re-fetch (deve buscar novamente)
    const cfg = await TenantService.getTenantConfig("lumi");
    expect(cfg).not.toBeNull();
  });
});
```

**Step 2: Rodar teste, ver falhar**

```bash
npx vitest run tests/tenantService.test.ts
```

Esperado: vai falhar até implementarmos `invalidate`/`invalidateAll`.

**Step 3: Reescrever TenantService**

```typescript
// src/services/tenantService.ts
import { getIntegrationAdapter } from "../integrations/ecommerce/index.js";
import { ShotzapProvider } from "../modules/automation/channels/shotzap/provider.js";
import { TenantRepository } from "../lib/repositories/tenant-repository.js";
import { IChannelProvider, TenantConfig } from "../types/automation.js";
import { logger } from "../utils/logger.js";

const providersMap: Record<string, any> = { shotzap: ShotzapProvider };

const CACHE_TTL_MS = 30_000;
interface CacheEntry { config: TenantConfig | null; expiresAt: number; }
const cache = new Map<string, CacheEntry>();

const repo = new TenantRepository({ fallbackToFiles: process.env.DISABLE_FILE_FALLBACK !== "1" });

export class TenantService {
  static async getTenantConfig(tenantId: string): Promise<TenantConfig | null> {
    const cached = cache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) return cached.config;

    const config = await this._build(tenantId);
    cache.set(tenantId, { config, expiresAt: Date.now() + CACHE_TTL_MS });
    return config;
  }

  static invalidate(tenantId: string) { cache.delete(tenantId); }
  static invalidateAll() { cache.clear(); }

  private static async _build(tenantId: string): Promise<TenantConfig | null> {
    const tenant = await repo.findById(tenantId);
    if (!tenant || tenant.status !== "active") return null;

    const ProviderClass = providersMap[tenant.providerType];
    if (!ProviderClass) {
      logger.error({ providerType: tenant.providerType, tenantId }, "Provider type desconhecido");
      return null;
    }

    const pCfg = tenant.providerConfig as any;
    if (!pCfg?.token) {
      logger.error({ tenantId }, "Tenant sem token no providerConfig");
      return null;
    }

    const provider = new ProviderClass({
      baseUrl: pCfg.baseUrl,
      token: pCfg.token,
      tagsCachePath: pCfg.tagsCachePath,
      paths: pCfg.paths,
    });

    const inputAdapter = getIntegrationAdapter(tenant.adapterType);

    // Templates: combina text + buttons num único objeto plano
    const templateRows = await repo.listTemplates(tenantId);
    const templates: Record<string, any> = {};
    for (const t of templateRows) templates[t.key] = t.content;

    return {
      id: tenant.id,
      name: tenant.name,
      adapterName: tenant.adapterType,
      inputAdapter,
      provider: provider as IChannelProvider,
      templates,
    };
  }
}
```

**Step 4: Rodar teste**

```bash
npx vitest run tests/tenantService.test.ts
```

Esperado: 3 PASS.

**Step 5: Verificar que ainda compila**

```bash
npx tsc --noEmit
```

Esperado: sem erros.

**Step 6: Commit**

```bash
git add src/services/tenantService.ts tests/tenantService.test.ts
git commit -m "refactor(tenant): TenantService reads from DB with cache + fallback"
```

---

### Task 6: Refatorar flow-registry

**Files:**
- Modify: `src/modules/automation/engine/flow-registry.ts`

**Step 1: Ler implementação atual**

```bash
cat src/modules/automation/engine/flow-registry.ts
```

**Step 2: Reescrever pra usar TenantRepository**

```typescript
// src/modules/automation/engine/flow-registry.ts
import { UseCase } from "../../../types/automation.js";
import { TenantRepository } from "../../../lib/repositories/tenant-repository.js";
import { logger } from "../../../utils/logger.js";

const repo = new TenantRepository({ fallbackToFiles: process.env.DISABLE_FILE_FALLBACK !== "1" });

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { flows: UseCase[]; expiresAt: number }>();

export async function listFlows(tenantId: string): Promise<UseCase[]> {
  const cached = cache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) return cached.flows;

  const rows = await repo.listFlows(tenantId);
  const flows: UseCase[] = rows
    .filter(r => r.enabled)
    .map(r => ({
      id: r.slug,
      title: r.title,
      aliases: r.aliases,
      description: r.description,
      steps: r.steps as any[],
    }));

  cache.set(tenantId, { flows, expiresAt: Date.now() + CACHE_TTL_MS });
  return flows;
}

export async function findFlowByAlias(tenantId: string, alias: string): Promise<UseCase | null> {
  const flows = await listFlows(tenantId);
  return flows.find(f => f.aliases.includes(alias)) || null;
}

export function invalidate(tenantId: string) { cache.delete(tenantId); }
export function invalidateAll() { cache.clear(); }

export async function reloadFlows(tenantId: string): Promise<UseCase[]> {
  invalidate(tenantId);
  return listFlows(tenantId);
}
```

**Step 3: Verificar compilação**

```bash
npx tsc --noEmit
```

**Step 4: Rodar testes existentes**

```bash
npx vitest run
```

Esperado: tudo passa.

**Step 5: Smoke test manual — webhook real local**

Subir backend (`npx tsx src/server.ts` em outro terminal). Disparar:

```bash
curl -X POST http://localhost:3847/webhooks/lumi \
  -H "Content-Type: application/json" \
  -d '{"taginternals":"open,pending,unpacked","FNAME":"Teste","phone":"5586999998888","extra1":"https://exemplo.com"}'
```

Esperado: log `📥 Webhook recebido` → `🔀 Evento normalizado` → `✅ Flow executado`. Conferir no Postgres `SELECT id, status FROM executions ORDER BY started_at DESC LIMIT 1;`.

**Step 6: Commit**

```bash
git add src/modules/automation/engine/flow-registry.ts
git commit -m "refactor(flow-registry): read flows from DB via TenantRepository"
```

---

## Phase 3 — Auth Zitadel (Release 1, parte C)

### Task 7: Middleware requireAuth (Zitadel JWT)

**Files:**
- Create: `src/middleware/require-auth.ts`
- Create: `tests/require-auth.test.ts`
- Modify: `src/config/env.ts`
- Modify: `package.json` (adicionar `jose`)

**Step 1: Adicionar `jose`**

```bash
npm install jose
```

**Step 2: Adicionar env vars**

Modificar `src/config/env.ts`:

```typescript
const envSchema = z.object({
  PORT: z.coerce.number().default(3847),
  FLOWS_DIR: z.string().default("flows"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  DATABASE_URL: z.string(),
  ZITADEL_ISSUER: z.string().default("https://id.vexvendas.com.br"),
  ZITADEL_AUDIENCE: z.string().optional(),
  DISABLE_AUTH: z.string().optional(),  // "1" desliga auth (dev)
  DISABLE_FILE_FALLBACK: z.string().optional(),
  SHOTZAP_TOKEN_LUMI: z.string().optional(),
  SHOTZAP_TOKEN_EBENEZER: z.string().optional(),
  SHOTZAP_TOKEN_OTICAJOA: z.string().optional(),
  ERP_WEBHOOK_SECRET: z.string().optional(),
});
```

**Step 3: Escrever teste do middleware**

```typescript
// tests/require-auth.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import { requireAuth } from "../src/middleware/require-auth.js";

describe("requireAuth", () => {
  it("retorna 401 sem header Authorization", async () => {
    const app = express();
    app.get("/", requireAuth, (_req, res) => res.json({ ok: true }));
    const res = await request(app).get("/");
    expect(res.status).toBe(401);
  });

  it("retorna 401 com Bearer token invalido", async () => {
    const app = express();
    app.get("/", requireAuth, (_req, res) => res.json({ ok: true }));
    const res = await request(app).get("/").set("Authorization", "Bearer invalid");
    expect(res.status).toBe(401);
  });

  it("permite quando DISABLE_AUTH=1", async () => {
    process.env.DISABLE_AUTH = "1";
    const app = express();
    app.get("/", requireAuth, (_req, res) => res.json({ ok: true }));
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    delete process.env.DISABLE_AUTH;
  });
});
```

**Step 4: Implementar middleware**

```typescript
// src/middleware/require-auth.ts
import type { Request, Response, NextFunction } from "express";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const issuer = env.ZITADEL_ISSUER.replace(/\/$/, "");
const jwks = createRemoteJWKSet(new URL(`${issuer}/oauth/v2/keys`));

export interface AuthenticatedRequest extends Request {
  auth?: { sub: string; email?: string; name?: string };
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (env.DISABLE_AUTH === "1") {
    req.auth = { sub: "dev", email: "dev@local" };
    return next();
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Bearer token" });
  }

  const token = header.slice(7);
  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: env.ZITADEL_AUDIENCE,
    });
    req.auth = {
      sub: payload.sub as string,
      email: (payload as any).email,
      name: (payload as any).name,
    };
    next();
  } catch (err: any) {
    logger.warn({ err: err.message }, "JWT inválido");
    res.status(401).json({ error: "Invalid token" });
  }
}
```

**Step 5: Rodar testes**

```bash
npx vitest run tests/require-auth.test.ts
```

Esperado: 3 PASS.

**Step 6: Commit**

```bash
git add src/middleware/require-auth.ts tests/require-auth.test.ts src/config/env.ts package.json package-lock.json
git commit -m "feat(auth): Zitadel JWT middleware (skipped if DISABLE_AUTH=1)"
```

---

### Task 8: Mover rotas /api/* pra /api/admin/*

**Files:**
- Modify: `src/app.ts`
- Modify: `src/routes/api/flows.ts`
- Modify: `src/routes/api/templates.ts`
- Modify: `src/routes/api/scheduler.ts`
- Modify: `src/routes/api/executions.ts`
- Modify: `src/routes/api/overview.ts`
- Modify: `src/routes/api/simulate.ts`
- Modify: `src/routes/api/tags.ts`
- Modify: `src/routes/api/config.ts`
- Modify: `web/src/lib/api.ts`

**Step 1: Em cada arquivo de rota, prefixar paths com `/api/admin/`**

Exemplo `src/routes/api/flows.ts`: trocar todas ocorrências de `"/api/flows` por `"/api/admin/flows`. Mesmo pra `templates`, `scheduler`, `executions`, `overview`, `simulate`, `tags`, `config`. Inclui também rotas como `/api/tenants`.

**Step 2: Em `src/app.ts`, aplicar `requireAuth` apenas no admin**

```typescript
// src/app.ts
import { requireAuth } from "./middleware/require-auth.js";
// ...

// Públicos (NÃO MUDAR ORDEM — webhooks antes do auth!)
app.use(healthRouter);
app.use(webhooksRouter);

// Admin protegido
app.use(requireAuth, flowsApiRouter);
app.use(requireAuth, configApiRouter);
app.use(requireAuth, simulateApiRouter);
app.use(requireAuth, templatesApiRouter);
app.use(requireAuth, overviewApiRouter);
app.use(requireAuth, tagsRouter);
app.use(requireAuth, schedulerApiRouter);
app.use(requireAuth, executionsApiRouter);

// SPA estático (servidor não autentica HTML; JS faz)
app.use(visualizerRouter);
const publicDir = path.join(process.cwd(), "public");
app.use(express.static(publicDir));
app.get("/builder", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));
app.get("/builder/*", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));
```

**Step 3: Atualizar `web/src/lib/api.ts` pra usar prefix `/api/admin/`**

Trocar `BASE` ou paths absolutos. Procurar:

```bash
grep -n "fetch(" web/src/lib/api.ts
```

E ajustar todas ocorrências.

**Step 4: Smoke test — webhook ainda público**

```bash
curl -i http://localhost:3847/webhooks/lumi -X POST -H "Content-Type: application/json" -d '{"taginternals":"open,pending,unpacked","FNAME":"X","phone":"55"}'
```

Esperado: `200 OK` (não 401).

**Step 5: Smoke test — admin protegido**

```bash
curl -i http://localhost:3847/api/admin/tenants
```

Esperado: `401 Unauthorized`.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat(routes): move admin routes under /api/admin and add auth middleware"
```

---

## Phase 4 — APIs admin de CRUD (Release 1, parte D)

### Task 9: API admin Tenants CRUD

**Files:**
- Create: `src/routes/api/admin/tenants.ts`
- Modify: `src/app.ts`
- Modify: `src/lib/repositories/tenant-repository.ts` (adicionar `upsert`, `delete`)

**Step 1: Adicionar métodos de escrita no repository**

Adicionar a `TenantRepository`:

```typescript
async upsertTenant(input: TenantRecord): Promise<TenantRecord> {
  const db = await getPrisma();
  const row = await db.tenant.upsert({
    where: { id: input.id },
    create: input,
    update: {
      name: input.name,
      status: input.status,
      adapterType: input.adapterType,
      providerType: input.providerType,
      adapterConfig: input.adapterConfig,
      providerConfig: input.providerConfig,
    },
  });
  return row as TenantRecord;
}

async setTenantStatus(id: string, status: "active" | "disabled"): Promise<void> {
  const db = await getPrisma();
  await db.tenant.update({ where: { id }, data: { status } });
}
```

**Step 2: Criar rotas**

```typescript
// src/routes/api/admin/tenants.ts
import { Router } from "express";
import { z } from "zod";
import { TenantRepository } from "../../../lib/repositories/tenant-repository.js";
import { TenantService } from "../../../services/tenantService.js";

const repo = new TenantRepository({ fallbackToFiles: false });
export const adminTenantsRouter = Router();

const TenantSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]+$/),
  name: z.string().min(1),
  status: z.enum(["active", "disabled"]).default("active"),
  adapterType: z.enum(["tray", "nuvemshop", "default"]),
  providerType: z.enum(["shotzap"]),
  adapterConfig: z.record(z.any()).default({}),
  providerConfig: z.object({
    baseUrl: z.string().url(),
    token: z.string().min(1),
    paths: z.record(z.string()).default({}),
    tagsCachePath: z.string().optional(),
  }),
});

adminTenantsRouter.get("/api/admin/tenants", async (_req, res) => {
  const list = await repo.list();
  res.json(list);
});

adminTenantsRouter.get("/api/admin/tenants/:id", async (req, res): Promise<any> => {
  const t = await repo.findById(req.params.id as string);
  if (!t) return res.status(404).json({ error: "Tenant not found" });
  res.json(t);
});

adminTenantsRouter.post("/api/admin/tenants", async (req, res): Promise<any> => {
  const parsed = TenantSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
  const saved = await repo.upsertTenant(parsed.data);
  TenantService.invalidate(saved.id);
  res.status(201).json(saved);
});

adminTenantsRouter.put("/api/admin/tenants/:id", async (req, res): Promise<any> => {
  const id = req.params.id as string;
  const parsed = TenantSchema.safeParse({ ...req.body, id });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
  const saved = await repo.upsertTenant(parsed.data);
  TenantService.invalidate(id);
  res.json(saved);
});

adminTenantsRouter.delete("/api/admin/tenants/:id", async (req, res): Promise<any> => {
  const id = req.params.id as string;
  await repo.setTenantStatus(id, "disabled");
  TenantService.invalidate(id);
  res.status(204).send();
});
```

**Step 3: Plugar no app.ts**

```typescript
import { adminTenantsRouter } from "./routes/api/admin/tenants.js";
// ...
app.use(requireAuth, adminTenantsRouter);
```

**Step 4: Smoke test**

Com `DISABLE_AUTH=1` no `.env` (dev):

```bash
curl http://localhost:3847/api/admin/tenants
# Esperado: array com lumi e oticajoa

curl -X POST http://localhost:3847/api/admin/tenants \
  -H "Content-Type: application/json" \
  -d '{"id":"teste","name":"Teste","adapterType":"default","providerType":"shotzap","adapterConfig":{},"providerConfig":{"baseUrl":"https://api2.shotzap.com.br","token":"x","paths":{}}}'
# Esperado: 201

curl -X DELETE http://localhost:3847/api/admin/tenants/teste
# Esperado: 204
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(admin): tenants CRUD API"
```

---

### Task 10: API admin Templates CRUD

**Files:**
- Create: `src/routes/api/admin/templates.ts`
- Modify: `src/app.ts`
- Modify: `src/lib/repositories/tenant-repository.ts`

**Step 1: Adicionar métodos no repository**

```typescript
async upsertTemplate(input: TemplateRecord): Promise<TemplateRecord> {
  const db = await getPrisma();
  const row = await db.template.upsert({
    where: { tenantId_kind_key: { tenantId: input.tenantId, kind: input.kind, key: input.key } },
    create: input,
    update: { content: input.content },
  });
  return row as TemplateRecord;
}

async deleteTemplate(tenantId: string, kind: string, key: string): Promise<void> {
  const db = await getPrisma();
  await db.template.delete({ where: { tenantId_kind_key: { tenantId, kind, key } } });
}
```

**Step 2: Criar rotas**

```typescript
// src/routes/api/admin/templates.ts
import { Router } from "express";
import { z } from "zod";
import { TenantRepository } from "../../../lib/repositories/tenant-repository.js";
import { TenantService } from "../../../services/tenantService.js";

const repo = new TenantRepository({ fallbackToFiles: false });
export const adminTemplatesRouter = Router();

const TemplateSchema = z.object({
  kind: z.enum(["text", "buttons"]),
  key: z.string().min(1),
  content: z.any(),
});

adminTemplatesRouter.get("/api/admin/tenants/:id/templates", async (req, res) => {
  const list = await repo.listTemplates(req.params.id as string);
  res.json(list);
});

adminTemplatesRouter.post("/api/admin/tenants/:id/templates", async (req, res): Promise<any> => {
  const tenantId = req.params.id as string;
  const parsed = TemplateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
  const saved = await repo.upsertTemplate({ tenantId, ...parsed.data });
  TenantService.invalidate(tenantId);
  res.status(201).json(saved);
});

adminTemplatesRouter.delete("/api/admin/tenants/:id/templates/:kind/:key", async (req, res): Promise<any> => {
  const tenantId = req.params.id as string;
  const kind = req.params.kind as string;
  const key = req.params.key as string;
  await repo.deleteTemplate(tenantId, kind, key);
  TenantService.invalidate(tenantId);
  res.status(204).send();
});
```

**Step 3: Plugar no app.ts e smoke test**

Igual à task 9. Conferir `GET /api/admin/tenants/lumi/templates` retorna lista.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(admin): templates CRUD API"
```

---

### Task 11: API admin Flows CRUD

**Files:**
- Create: `src/routes/api/admin/flows.ts`
- Modify: `src/app.ts`
- Modify: `src/lib/repositories/tenant-repository.ts`
- Modify: `src/modules/automation/engine/flow-registry.ts` (export invalidate)

**Step 1: Adicionar métodos no repository**

```typescript
async upsertFlow(input: FlowRecord): Promise<FlowRecord> {
  const db = await getPrisma();
  const row = await db.flow.upsert({
    where: { tenantId_slug: { tenantId: input.tenantId, slug: input.slug } },
    create: input,
    update: {
      title: input.title,
      aliases: input.aliases,
      description: input.description,
      steps: input.steps,
      enabled: input.enabled,
    },
  });
  return row as FlowRecord;
}

async deleteFlow(tenantId: string, slug: string): Promise<void> {
  const db = await getPrisma();
  await db.flow.delete({ where: { tenantId_slug: { tenantId, slug } } });
}
```

**Step 2: Criar rotas**

```typescript
// src/routes/api/admin/flows.ts
import { Router } from "express";
import { z } from "zod";
import { TenantRepository } from "../../../lib/repositories/tenant-repository.js";
import { invalidate as invalidateFlowRegistry } from "../../../modules/automation/engine/flow-registry.js";

const repo = new TenantRepository({ fallbackToFiles: false });
export const adminFlowsRouter = Router();

const FlowSchema = z.object({
  slug: z.string().regex(/^[a-z0-9_-]+$/),
  title: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  description: z.string().default(""),
  steps: z.array(z.any()).min(1),
  enabled: z.boolean().default(true),
});

adminFlowsRouter.get("/api/admin/tenants/:id/flows", async (req, res) => {
  const list = await repo.listFlows(req.params.id as string);
  res.json(list);
});

adminFlowsRouter.get("/api/admin/tenants/:id/flows/:slug", async (req, res): Promise<any> => {
  const list = await repo.listFlows(req.params.id as string);
  const found = list.find(f => f.slug === req.params.slug);
  if (!found) return res.status(404).json({ error: "Flow not found" });
  res.json(found);
});

adminFlowsRouter.post("/api/admin/tenants/:id/flows", async (req, res): Promise<any> => {
  const tenantId = req.params.id as string;
  const parsed = FlowSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });
  const saved = await repo.upsertFlow({ tenantId, ...parsed.data });
  invalidateFlowRegistry(tenantId);
  res.status(201).json(saved);
});

adminFlowsRouter.delete("/api/admin/tenants/:id/flows/:slug", async (req, res): Promise<any> => {
  const tenantId = req.params.id as string;
  await repo.deleteFlow(tenantId, req.params.slug as string);
  invalidateFlowRegistry(tenantId);
  res.status(204).send();
});
```

**Step 3: Smoke test**

```bash
curl http://localhost:3847/api/admin/tenants/lumi/flows
# Esperado: 6 flows
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(admin): flows CRUD API"
```

---

### Task 12: Endpoint de schema dos adapters (form dinâmico)

**Files:**
- Create: `src/routes/api/admin/adapters.ts`
- Modify: `src/app.ts`

**Step 1: Definir schemas**

```typescript
// src/routes/api/admin/adapters.ts
import { Router } from "express";

export const adminAdaptersRouter = Router();

const adapters = [
  {
    type: "tray",
    label: "Tray Commerce",
    fields: [
      { name: "apiAddress", label: "API Address da Loja", type: "url", required: true, help: "URL retornada na ativação do app na Tray" },
      { name: "vars.link_loja", label: "URL pública da loja", type: "url", required: true },
    ],
    requiresOAuth: true,
  },
  {
    type: "nuvemshop",
    label: "Nuvemshop (via n8n)",
    fields: [
      { name: "vars.link_loja", label: "URL pública da loja", type: "url", required: true },
    ],
    requiresOAuth: false,
  },
  {
    type: "default",
    label: "Default (genérico)",
    fields: [
      { name: "vars.link_loja", label: "URL pública da loja", type: "url", required: false },
    ],
    requiresOAuth: false,
  },
];

const providers = [
  {
    type: "shotzap",
    label: "Shotzap",
    fields: [
      { name: "baseUrl", label: "Base URL Shotzap", type: "url", required: true, default: "https://api2.shotzap.com.br" },
      { name: "token", label: "Token Shotzap", type: "password", required: true },
      { name: "tagsCachePath", label: "Tags cache path", type: "text", required: false },
      { name: "paths.sendText", label: "Path sendText", type: "text", default: "/api/messages/send" },
      { name: "paths.addTag", label: "Path addTag", type: "text", default: "/api/tags/add" },
    ],
  },
];

adminAdaptersRouter.get("/api/admin/adapters", (_req, res) => res.json(adapters));
adminAdaptersRouter.get("/api/admin/providers", (_req, res) => res.json(providers));
```

**Step 2: Plugar e testar**

```bash
curl http://localhost:3847/api/admin/adapters
curl http://localhost:3847/api/admin/providers
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat(admin): adapters and providers schema endpoints"
```

---

## Phase 5 — Tray real (Release 1, parte E)

### Task 13: TrayClient (lookup + refresh)

**Files:**
- Create: `src/integrations/ecommerce/tray/client.ts`
- Create: `src/integrations/ecommerce/tray/types.ts`
- Modify: `src/lib/repositories/tenant-repository.ts` (métodos OAuthToken)

**Step 1: Adicionar métodos no repository**

```typescript
// src/lib/repositories/tenant-repository.ts (apêndice)
async findOAuthToken(tenantId: string, provider: string) {
  const db = await getPrisma();
  return db.oAuthToken.findUnique({
    where: { tenantId_provider: { tenantId, provider } },
  });
}

async upsertOAuthToken(input: {
  tenantId: string;
  provider: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt: Date;
  scope?: string | null;
}) {
  const db = await getPrisma();
  return db.oAuthToken.upsert({
    where: { tenantId_provider: { tenantId: input.tenantId, provider: input.provider } },
    create: { ...input, refreshFailures: 0, lastRefreshAt: new Date() },
    update: {
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      expiresAt: input.expiresAt,
      scope: input.scope,
      lastRefreshAt: new Date(),
      refreshFailures: 0,
    },
  });
}

async incrementRefreshFailure(tenantId: string, provider: string) {
  const db = await getPrisma();
  return db.oAuthToken.update({
    where: { tenantId_provider: { tenantId, provider } },
    data: { refreshFailures: { increment: 1 } },
  });
}

async listExpiringTokens(provider: string, withinMs: number) {
  const db = await getPrisma();
  return db.oAuthToken.findMany({
    where: {
      provider,
      expiresAt: { lt: new Date(Date.now() + withinMs) },
      refreshFailures: { lt: 3 },
    },
  });
}
```

**Step 2: Criar types**

```typescript
// src/integrations/ecommerce/tray/types.ts
export interface TrayOrder {
  id: number;
  status: string;
  status_id: number;
  customer: { name: string; cellphone?: string; phone?: string; email?: string };
  shipment_value?: number;
  total?: number;
  tracking_code?: string;
  tracking_url?: string;
  link_payment?: string;
  link_track?: string;
  Order?: any; // formato wrapped da Tray
  [k: string]: any;
}
```

**Step 3: Implementar cliente**

```typescript
// src/integrations/ecommerce/tray/client.ts
import axios, { AxiosInstance } from "axios";
import { TenantRepository } from "../../../lib/repositories/tenant-repository.js";
import { logger } from "../../../utils/logger.js";
import { TrayOrder } from "./types.js";

const repo = new TenantRepository({ fallbackToFiles: false });

export class TrayClient {
  private apiAddress: string;
  private http: AxiosInstance;

  static async forTenant(tenantId: string): Promise<TrayClient> {
    const tenant = await repo.findById(tenantId);
    if (!tenant) throw new Error(`Tenant ${tenantId} não encontrado`);

    const apiAddress = (tenant.adapterConfig as any)?.apiAddress;
    if (!apiAddress) throw new Error(`Tenant ${tenantId} sem apiAddress da Tray`);

    const token = await repo.findOAuthToken(tenantId, "tray");
    if (!token) throw new Error(`Tenant ${tenantId} sem OAuthToken da Tray`);

    return new TrayClient(tenantId, apiAddress, token.accessToken);
  }

  constructor(public tenantId: string, apiAddress: string, accessToken: string) {
    this.apiAddress = apiAddress.replace(/\/$/, "");
    this.http = axios.create({
      baseURL: this.apiAddress,
      params: { access_token: accessToken },
      timeout: 15000,
    });
  }

  async getOrder(orderId: string | number): Promise<TrayOrder | null> {
    try {
      const res = await this.http.get(`/orders/${orderId}`);
      const data = res.data;
      // Tray tipicamente envelopa em { Order: {...} }
      return (data?.Order || data) as TrayOrder;
    } catch (err: any) {
      logger.warn({ err: err.message, tenantId: this.tenantId, orderId }, "TrayClient.getOrder falhou");
      return null;
    }
  }

  /** Refresh — usa refresh_token da tabela */
  static async refresh(tenantId: string): Promise<boolean> {
    const tenant = await repo.findById(tenantId);
    const token = await repo.findOAuthToken(tenantId, "tray");
    if (!tenant || !token?.refreshToken) {
      logger.warn({ tenantId }, "Refresh sem refresh_token disponível");
      return false;
    }
    const apiAddress = (tenant.adapterConfig as any)?.apiAddress;

    try {
      // Tray refresh: GET /auth?refresh_token=...
      const res = await axios.get(`${apiAddress}/auth`, {
        params: { refresh_token: token.refreshToken },
        timeout: 15000,
      });
      const body = res.data || {};
      const accessToken = body.access_token;
      const refreshToken = body.refresh_token || token.refreshToken;
      const expiresIn = Number(body.expires_in || 3600);

      if (!accessToken) throw new Error("Resposta sem access_token");

      await repo.upsertOAuthToken({
        tenantId,
        provider: "tray",
        accessToken,
        refreshToken,
        expiresAt: new Date(Date.now() + expiresIn * 1000),
        scope: body.scope || null,
      });
      logger.info({ tenantId, expiresIn }, "Tray token refreshed");
      return true;
    } catch (err: any) {
      logger.error({ err: err.message, tenantId }, "Refresh Tray falhou");
      await repo.incrementRefreshFailure(tenantId, "tray");
      return false;
    }
  }
}
```

**Step 4: Compilar**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(tray): OAuth client (getOrder + refresh)"
```

---

### Task 14: TrayAdapter real

**Files:**
- Create: `src/integrations/ecommerce/tray-adapter.ts`
- Modify: `src/integrations/ecommerce/index.ts`

**Step 1: Implementar adapter**

```typescript
// src/integrations/ecommerce/tray-adapter.ts
import crypto from "crypto";
import { EcommerceAdapter } from "./base-adapter.js";
import { NormalizedEvent } from "../../types/integration.js";
import { TrayClient } from "./tray/client.js";
import { logger } from "../../utils/logger.js";

// Mapping conforme status da Tray (ajustar conforme observado em produção)
const statusToFlow: Array<{ match: string | RegExp; flowAlias: (tenantPrefix: string) => string }> = [
  { match: /aguardando.*pagamento|pendente/i, flowAlias: p => `${p} Pedido Recebido` },
  { match: /pagamento.*aprovado|pago|paid/i, flowAlias: p => `${p} Pedido Pago` },
  { match: /enviado|shipped|despachado/i, flowAlias: p => `${p} Pedido Enviado` },
  { match: /entregue|delivered/i, flowAlias: p => `${p} Pedido Entregue` },
  { match: /cancelado|canceled|cancelled/i, flowAlias: p => `${p} Pedido Cancelado1` },
];

export class TrayAdapter extends EcommerceAdapter {
  /**
   * tenantPrefix vem da config do tenant (e.g. "[OJ]"). Default vazio.
   */
  constructor(private tenantPrefix: string = "[OJ]") { super(); }

  async normalizeEventAsync(rawEvent: any, tenantId: string): Promise<NormalizedEvent | null> {
    const scope = (rawEvent?.scope_name || "").toString().toLowerCase();
    const scopeId = rawEvent?.scope_id?.toString();
    const act = (rawEvent?.act || "").toString().toLowerCase();

    if (scope !== "order" || !scopeId) {
      logger.info({ scope, scopeId, act, tenantId }, "TrayAdapter: webhook ignorado (escopo não-order ou sem id)");
      return null;
    }

    let client: TrayClient;
    try {
      client = await TrayClient.forTenant(tenantId);
    } catch (err: any) {
      logger.warn({ err: err.message, tenantId }, "TrayAdapter: cliente indisponível");
      return null;
    }

    const order = await client.getOrder(scopeId);
    if (!order) return null;

    const status = (order.status || "").toString();
    const rule = statusToFlow.find(r =>
      typeof r.match === "string" ? status.toLowerCase().includes(r.match.toLowerCase()) : r.match.test(status)
    );
    if (!rule) {
      logger.info({ tenantId, scopeId, status }, "TrayAdapter: status não mapeado");
      return null;
    }

    const flowAlias = rule.flowAlias(this.tenantPrefix);
    const phone = order.customer?.cellphone || order.customer?.phone || "";
    const name = order.customer?.name || "";

    return {
      flowAlias,
      customer: { name, phone, tags: [] },
      data: {
        email: order.customer?.email,
        extra1: order.tracking_url || order.link_track || order.link_payment || "",
        extra2: order.link_payment || "",
        extra3: "",
        choice: rawEvent?.choice,
      },
    };
  }

  // Mantém interface síncrona (será adaptado no chamador)
  normalizeEvent(_rawEvent: any): NormalizedEvent | null {
    throw new Error("TrayAdapter requires async — use normalizeEventAsync(raw, tenantId)");
  }

  isSignatureValid(req: any, secret: string): boolean {
    const sig = req.headers["x-tray-signature"];
    if (!sig) return false;
    const expected = crypto.createHmac("sha256", secret).update(JSON.stringify(req.body)).digest("hex");
    return sig === expected;
  }
}
```

**Step 2: Adaptar webhook handler para suportar adapter async**

Modificar `src/routes/webhooks.ts`. Onde chama `inputAdapter.normalizeEvent(req.body)`, adicionar branch:

```typescript
let normalizedEvent;
if ("normalizeEventAsync" in inputAdapter && typeof (inputAdapter as any).normalizeEventAsync === "function") {
  normalizedEvent = await (inputAdapter as any).normalizeEventAsync(req.body, tenantId);
} else {
  normalizedEvent = inputAdapter.normalizeEvent(req.body);
}
```

**Step 3: Registrar adapter**

```typescript
// src/integrations/ecommerce/index.ts
import { DefaultAdapter } from "./default-adapter.js";
import { NuvemshopAdapter } from "./nuvemshop-adapter.js";
import { TrayAdapter } from "./tray-adapter.js";
import { IIntegrationAdapter } from "../../types/integration.js";

const adapters: Record<string, IIntegrationAdapter> = {
  default: new DefaultAdapter(),
  tray: new TrayAdapter("[OJ]"), // prefix default; override via config no futuro
  nuvemshop: new NuvemshopAdapter(),
};

export const getIntegrationAdapter = (providerName: string): IIntegrationAdapter => {
  return adapters[providerName] || adapters.default;
};
```

**Step 4: Compilar e commit**

```bash
npx tsc --noEmit
git add -A
git commit -m "feat(tray): real adapter with OAuth lookup"
```

---

### Task 15: Cron de refresh OAuth

**Files:**
- Create: `src/modules/scheduler/oauth-refresh.ts`
- Modify: `src/server.ts`

**Step 1: Implementar cron**

```typescript
// src/modules/scheduler/oauth-refresh.ts
import { TenantRepository } from "../../lib/repositories/tenant-repository.js";
import { TrayClient } from "../../integrations/ecommerce/tray/client.js";
import { logger } from "../../utils/logger.js";

const repo = new TenantRepository({ fallbackToFiles: false });
const REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 min
const RENEW_BEFORE_MS = 60 * 60 * 1000;    // 1h antes de expirar

let interval: NodeJS.Timeout | null = null;

async function tick() {
  try {
    const expiring = await repo.listExpiringTokens("tray", RENEW_BEFORE_MS);
    if (expiring.length === 0) return;
    logger.info({ count: expiring.length }, "OAuth refresh: tokens expirando");
    for (const t of expiring) {
      await TrayClient.refresh(t.tenantId);
    }
  } catch (err: any) {
    logger.error({ err: err.message }, "OAuth refresh tick falhou");
  }
}

export function startOAuthRefreshWorker() {
  if (interval) return;
  logger.info(">>> [OAuth Refresh] Worker iniciado");
  tick(); // primeira execução imediata
  interval = setInterval(tick, REFRESH_INTERVAL_MS);
}

export function stopOAuthRefreshWorker() {
  if (interval) clearInterval(interval);
  interval = null;
}
```

**Step 2: Subir no server.ts**

Modificar `src/server.ts`:

```typescript
import { startOAuthRefreshWorker } from "./modules/scheduler/oauth-refresh.js";
// ...
const start = async () => {
  await connectRedis();
  await SchedulerService.init();
  await restoreChoicesFromRedis();
  startOAuthRefreshWorker();
  app.listen(env.PORT, () => logger.info(`Servidor escutando na porta ${env.PORT}`));
};
```

**Step 3: Compilar e commit**

```bash
npx tsc --noEmit
git add -A
git commit -m "feat(oauth): 15min refresh worker for Tray tokens"
```

---

### Task 16: API admin OAuth Tray

**Files:**
- Create: `src/routes/api/admin/oauth.ts`
- Modify: `src/app.ts`

**Step 1: Criar rotas**

```typescript
// src/routes/api/admin/oauth.ts
import { Router } from "express";
import { z } from "zod";
import { TenantRepository } from "../../../lib/repositories/tenant-repository.js";
import { TrayClient } from "../../../integrations/ecommerce/tray/client.js";

const repo = new TenantRepository({ fallbackToFiles: false });
export const adminOAuthRouter = Router();

const TrayCompleteSchema = z.object({
  apiAddress: z.string().url(),
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  expiresIn: z.number().int().positive(),
  scope: z.string().optional(),
});

adminOAuthRouter.get("/api/admin/tenants/:id/oauth/tray/status", async (req, res): Promise<any> => {
  const tenantId = req.params.id as string;
  const t = await repo.findOAuthToken(tenantId, "tray");
  if (!t) return res.json({ connected: false });
  res.json({
    connected: true,
    expiresAt: t.expiresAt,
    lastRefreshAt: t.lastRefreshAt,
    refreshFailures: t.refreshFailures,
    scope: t.scope,
  });
});

adminOAuthRouter.post("/api/admin/tenants/:id/oauth/tray/complete", async (req, res): Promise<any> => {
  const tenantId = req.params.id as string;
  const parsed = TrayCompleteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.format() });

  // Atualiza apiAddress no adapterConfig do tenant
  const tenant = await repo.findById(tenantId);
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });
  const newAdapterConfig = { ...(tenant.adapterConfig as any), apiAddress: parsed.data.apiAddress };
  await repo.upsertTenant({ ...tenant, adapterConfig: newAdapterConfig });

  const expiresAt = new Date(Date.now() + parsed.data.expiresIn * 1000);
  await repo.upsertOAuthToken({
    tenantId,
    provider: "tray",
    accessToken: parsed.data.accessToken,
    refreshToken: parsed.data.refreshToken || null,
    expiresAt,
    scope: parsed.data.scope || null,
  });
  res.status(201).json({ connected: true, expiresAt });
});

adminOAuthRouter.post("/api/admin/tenants/:id/oauth/tray/refresh-now", async (req, res): Promise<any> => {
  const tenantId = req.params.id as string;
  const ok = await TrayClient.refresh(tenantId);
  if (!ok) return res.status(400).json({ refreshed: false });
  res.json({ refreshed: true });
});
```

**Step 2: Plugar no app.ts e commit**

```bash
git add -A
git commit -m "feat(admin): OAuth Tray endpoints (status/complete/refresh-now)"
```

---

## Phase 6 — Frontend admin (Release 1, parte F)

### Task 17: AuthGuard com oidc-client-ts

**Files:**
- Create: `web/src/auth/oidc.ts`
- Create: `web/src/auth/AuthGuard.tsx`
- Modify: `web/src/main.tsx` (envolver App)
- Modify: `web/package.json` (adicionar `oidc-client-ts`)

**Step 1: Instalar dep**

```bash
cd web && npm install oidc-client-ts
```

**Step 2: Implementar OIDC manager**

```typescript
// web/src/auth/oidc.ts
import { UserManager, WebStorageStateStore } from "oidc-client-ts";

const issuer = import.meta.env.VITE_ZITADEL_ISSUER || "https://id.vexvendas.com.br";
const clientId = import.meta.env.VITE_ZITADEL_CLIENT_ID;

if (!clientId && import.meta.env.PROD) {
  throw new Error("VITE_ZITADEL_CLIENT_ID obrigatório em produção");
}

export const userManager = new UserManager({
  authority: issuer,
  client_id: clientId || "dev-client",
  redirect_uri: `${window.location.origin}/auth/callback`,
  post_logout_redirect_uri: window.location.origin,
  response_type: "code",
  scope: "openid profile email",
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  automaticSilentRenew: true,
});

export async function getAccessToken(): Promise<string | null> {
  const user = await userManager.getUser();
  if (!user || user.expired) return null;
  return user.access_token;
}
```

**Step 3: Implementar AuthGuard**

```tsx
// web/src/auth/AuthGuard.tsx
import { useEffect, useState } from "react";
import { userManager } from "./oidc";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      // Callback?
      if (window.location.pathname === "/auth/callback") {
        try {
          await userManager.signinRedirectCallback();
          window.location.replace("/");
          return;
        } catch (e) {
          console.error(e);
          window.location.replace("/");
          return;
        }
      }

      const user = await userManager.getUser();
      if (!user || user.expired) {
        await userManager.signinRedirect();
        return;
      }
      setReady(true);
    })();
  }, []);

  if (!ready) return <div className="p-8 text-center">Carregando…</div>;
  return <>{children}</>;
}
```

**Step 4: Envolver App**

```tsx
// web/src/main.tsx
import { AuthGuard } from "./auth/AuthGuard";
// ...
<AuthGuard><App /></AuthGuard>
```

**Step 5: Atualizar `web/src/lib/api.ts` pra mandar Bearer**

```typescript
import { getAccessToken } from "../auth/oidc";

const BASE = "/api/admin";

async function authedFetch(input: RequestInfo, init: RequestInit = {}) {
  const token = await getAccessToken();
  return fetch(input, {
    ...init,
    headers: {
      ...(init.headers || {}),
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

export async function listTenants(): Promise<Tenant[]> {
  const res = await authedFetch(`${BASE}/tenants`);
  return res.json();
}
// ... resto idem
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat(web): Zitadel AuthGuard with oidc-client-ts"
```

---

### Task 18: Página TenantList

**Files:**
- Create: `web/src/components/TenantList.tsx`
- Modify: `web/src/App.tsx` (adicionar tab)

**Step 1: Implementar componente**

```tsx
// web/src/components/TenantList.tsx
import { useEffect, useState } from "react";

interface Tenant {
  id: string; name: string; status: string;
  adapterType: string; providerType: string;
}

export function TenantList({ onSelect }: { onSelect: (id: string) => void }) {
  const [tenants, setTenants] = useState<Tenant[]>([]);

  useEffect(() => {
    fetch("/api/admin/tenants").then(r => r.json()).then(setTenants);
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Tenants</h2>
      <table className="w-full">
        <thead>
          <tr><th>ID</th><th>Nome</th><th>Adapter</th><th>Status</th></tr>
        </thead>
        <tbody>
          {tenants.map(t => (
            <tr key={t.id} className="hover:bg-gray-100 cursor-pointer" onClick={() => onSelect(t.id)}>
              <td>{t.id}</td>
              <td>{t.name}</td>
              <td>{t.adapterType}</td>
              <td>{t.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Step 2: Plugar no App.tsx (tab "Tenants" no sidebar)**

**Step 3: Smoke test no navegador**

Esperado: lista lumi e oticajoa.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(web): TenantList page"
```

---

### Task 19: Página TenantDetail (4 abas)

**Files:**
- Create: `web/src/components/TenantDetail.tsx`
- Create: `web/src/components/tenant/ConfigTab.tsx`
- Create: `web/src/components/tenant/TemplatesTab.tsx`
- Create: `web/src/components/tenant/FlowsTab.tsx`
- Create: `web/src/components/tenant/OAuthTrayTab.tsx`

**Step 1: Estrutura básica com tabs**

```tsx
// web/src/components/TenantDetail.tsx
import { useState } from "react";
import { ConfigTab } from "./tenant/ConfigTab";
import { TemplatesTab } from "./tenant/TemplatesTab";
import { FlowsTab } from "./tenant/FlowsTab";
import { OAuthTrayTab } from "./tenant/OAuthTrayTab";

export function TenantDetail({ tenantId }: { tenantId: string }) {
  const [tab, setTab] = useState<"config"|"templates"|"flows"|"oauth">("config");
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold">{tenantId}</h2>
      <nav className="flex gap-4 my-4 border-b">
        {(["config","templates","flows","oauth"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={tab === t ? "font-bold" : ""}>{t}</button>
        ))}
      </nav>
      {tab === "config" && <ConfigTab tenantId={tenantId} />}
      {tab === "templates" && <TemplatesTab tenantId={tenantId} />}
      {tab === "flows" && <FlowsTab tenantId={tenantId} />}
      {tab === "oauth" && <OAuthTrayTab tenantId={tenantId} />}
    </div>
  );
}
```

**Step 2: Implementar `ConfigTab`** (carrega `/api/admin/adapters` e `/api/admin/providers`, gera form, salva via PUT). Ver design doc seção 4.2.

**Step 3: Implementar `TemplatesTab`** (lista, cria/edita templates). Editor textarea pra `text`, form pra `buttons`.

**Step 4: Implementar `FlowsTab`** (reusa `FlowEditor` existente com novos endpoints).

**Step 5: Implementar `OAuthTrayTab`** (mostra status, form pra colar accessToken/refreshToken/apiAddress vindos da Tray, botão "Refresh now").

**Step 6: Smoke test no navegador.**

**Step 7: Commit (cada tab pode ser commit separado)**

```bash
git add -A
git commit -m "feat(web): TenantDetail with config/templates/flows/oauth tabs"
```

---

### Task 20: Validação fim-a-fim local + commit + deploy Release 1

**Files:** —

**Step 1: Garantir que todos os testes passam**

```bash
npx vitest run
```

**Step 2: Disparar webhook real Lumi local e validar**

```bash
curl -X POST http://localhost:3847/webhooks/lumi \
  -H "Content-Type: application/json" \
  -d '{"taginternals":"open,pending,unpacked","FNAME":"Smoke","phone":"5586999990001","extra1":"https://exemplo.com/p"}'
```

Verificar:
- Log mostra fluxo executando.
- `SELECT id, status FROM executions ORDER BY started_at DESC LIMIT 1;` mostra entrada nova.

**Step 3: Push pra `main`**

```bash
git push origin main
```

**Step 4: Adicionar env vars no Coolify**

```bash
ssh root@46.224.162.157 "curl -s -X POST 'http://localhost:8000/api/v1/applications/esecie120gnias2bkead40jv/envs' -H 'Authorization: Bearer 1|sK8c6daEwEEuPhTtlqvXUZUJyNaiiSMWBfcEKXggacd43f4e' -H 'Content-Type: application/json' -d '{\"key\":\"ZITADEL_ISSUER\",\"value\":\"https://id.vexvendas.com.br\",\"is_preview\":false}'"
```

**Step 5: Trigger redeploy**

```bash
ssh root@46.224.162.157 "curl -s -X POST 'http://localhost:8000/api/v1/deploy?uuid=esecie120gnias2bkead40jv' -H 'Authorization: Bearer 1|sK8c6daEwEEuPhTtlqvXUZUJyNaiiSMWBfcEKXggacd43f4e'"
```

**Step 6: Validar produção**

```bash
ssh root@46.224.162.157 "docker logs --tail 50 \$(docker ps --format '{{.Names}}' | grep esecie | head -1)"
# Confirmar: seed rodou, webhook lumi continua funcionando, Postgres tem dados
```

Pingar webhook real Lumi (n8n) e confirmar que cai no DB.

**Step 7: Commit "release 1 deployed"**

(Não há mudança de código; tag opcional.)

```bash
git tag -a release-1-tenants-db -m "Release 1: tenants in DB with file fallback"
git push origin release-1-tenants-db
```

---

## Phase 7 — Cutover (Release 2)

### Task 21: Validação 1-2 dias

**Step 1:** Monitorar logs e execuções por 1-2 dias após Release 1.

**Step 2:** Verificar que jobs agendados antigos do Redis processam OK.

**Step 3:** Confirmar que webhooks Lumi continuam normais.

Não há código — só observar.

---

### Task 22: Remover fallback + arquivos

**Files:**
- Delete: `src/config/tenants.json`
- Delete: `src/tenants/lumi/templates.json`
- Delete: `src/tenants/lumi/flows/*.json`
- Delete: `src/tenants/oticajoa/templates.json`
- Delete: `src/tenants/oticajoa/flows/*.json`
- Modify: `src/services/tenantService.ts` (remover fallback)
- Modify: `src/lib/repositories/tenant-repository.ts` (remover métodos `_loadXFromFile`)
- Modify: `src/modules/automation/engine/flow-registry.ts` (remover fallback)
- Modify: `docker-entrypoint.sh` (remover seed)

**Step 1:** Setar `DISABLE_FILE_FALLBACK=1` em Coolify.

**Step 2:** Validar produção continua bem por 1 hora.

**Step 3:** Deletar arquivos e fallback do código.

**Step 4:** Remover env vars antigas de token (`SHOTZAP_TOKEN_LUMI` etc) de Coolify — agora vêm do DB.

**Step 5:** Push + deploy.

**Step 6:** Commit final.

```bash
git add -A
git commit -m "feat(release-2): remove file fallback and source files"
git tag release-2-cutover
git push origin main release-2-cutover
```

---

### Task 23: Cadastrar Ótica Joá no admin + ativar Tray

**Step 1:** Pelo admin, criar app Tray no Zitadel (e setar `VITE_ZITADEL_CLIENT_ID` no Coolify do shot-tray).

**Step 2:** Pelo admin, abrir TenantDetail oticajoa → aba OAuth Tray → preencher `apiAddress`, `accessToken`, `refreshToken`, `expiresIn` (tudo vem do callback de instalação do app na Tray).

**Step 3:** Configurar webhook na Tray apontando pra `https://webhooks.shotzap.com.br/webhooks/oticajoa`.

**Step 4:** Disparar pedido teste na Tray e confirmar que flow roda.

---

## Skills referenciadas

- @superpowers:executing-plans (executar este plano)
- @superpowers:test-driven-development (TDD onde indicado)
- @superpowers:verification-before-completion (validar antes de claim de completo)
