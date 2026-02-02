import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  SHOTZAP_BASE_URL: z.string().url(),
  SHOTZAP_CONNECTION_TOKEN: z.string().min(1),
  SHOTZAP_SEND_BUTTONS_PATH: z.string().default("/api/messages/whatsmeow/sendButtonsPRO"),
  SHOTZAP_SEND_TEXT_PATH: z.string().default("/api/messages/whatsmeow/sendText"),
  SHOTZAP_TAG_ADD_PATH: z.string().default("/api/tags/add"),
  SHOTZAP_TAG_REMOVE_PATH: z.string().default("/api/tags/remove"),
  ERP_WEBHOOK_SECRET: z.string().min(8).default("change-me")
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Erro ao validar variáveis de ambiente", parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
