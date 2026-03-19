import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3005),
  FLOWS_DIR: z.string().default("flows"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Variáveis de ambiente inválidas:", parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
