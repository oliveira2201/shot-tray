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
      let count = 0;
      for (const [key, content] of Object.entries(parsed.text || {})) {
        await db.template.upsert({
          where: { tenantId_kind_key: { tenantId: t.id, kind: "text", key } },
          create: { tenantId: t.id, kind: "text", key, content: content as any },
          update: { content: content as any },
        });
        count++;
      }
      for (const [key, content] of Object.entries(parsed.buttons || {})) {
        await db.template.upsert({
          where: { tenantId_kind_key: { tenantId: t.id, kind: "buttons", key } },
          create: { tenantId: t.id, kind: "buttons", key, content: content as any },
          update: { content: content as any },
        });
        count++;
      }
      logger.info({ tenantId: t.id, count }, "Templates upserted");
    } catch (err: any) {
      if (err?.code !== "ENOENT") {
        logger.warn({ err: err.message, tenantId: t.id }, "Templates não importados");
      }
    }

    // Flows
    try {
      const flowsDir = path.join(process.cwd(), "src", "tenants", t.id, "flows");
      const files = await fs.readdir(flowsDir);
      let count = 0;
      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const raw = await fs.readFile(path.join(flowsDir, file), "utf-8");
        const parsed = JSON.parse(raw);
        const slug = path.basename(file, ".json");
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
        count++;
      }
      logger.info({ tenantId: t.id, count }, "Flows upserted");
    } catch (err: any) {
      if (err?.code !== "ENOENT") {
        logger.warn({ err: err.message, tenantId: t.id }, "Flows não importados");
      }
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
