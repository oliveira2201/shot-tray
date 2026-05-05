import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3847),
  FLOWS_DIR: z.string().default("flows"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  DATABASE_URL: z.string(),
  ZITADEL_ISSUER: z.string().default("https://id.vexvendas.com.br"),
  ZITADEL_AUDIENCE: z.string().optional(),
  DISABLE_AUTH: z.string().optional(),       // "1" desliga auth (dev)
  DISABLE_FILE_FALLBACK: z.string().optional(),
  ERP_WEBHOOK_SECRET: z.string().optional(),
  /** Dev: limita qualquer cancelableWait a N segundos (pra testar cadeias rápido) */
  FLOW_WAIT_TURBO: z.coerce.number().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Variáveis de ambiente inválidas:", parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
