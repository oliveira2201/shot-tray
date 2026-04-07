CREATE TABLE IF NOT EXISTS "executions" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenant_id" TEXT NOT NULL,
  "flow_id" TEXT NOT NULL,
  "flow_alias" TEXT NOT NULL,
  "phone" TEXT,
  "customer_name" TEXT,
  "status" TEXT NOT NULL DEFAULT 'running',
  "trigger" TEXT NOT NULL DEFAULT 'webhook',
  "steps" JSONB NOT NULL DEFAULT '[]',
  "error" TEXT,
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completed_at" TIMESTAMPTZ,
  "duration_ms" INTEGER,
  "webhook_payload" JSONB,
  "webhook_received_at" TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS "idx_exec_tenant_started" ON "executions" ("tenant_id", "started_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_exec_tenant_status" ON "executions" ("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "idx_exec_tenant_flow" ON "executions" ("tenant_id", "flow_id");
CREATE INDEX IF NOT EXISTS "idx_exec_phone" ON "executions" ("phone");
