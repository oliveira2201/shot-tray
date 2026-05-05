// Debug tag add/get SEM ENVIAR NENHUMA MENSAGEM WHATSAPP.
// Chama direto o provider pra verificar se addTag/getContactTags funcionam.
//
// Uso: node scripts/debug-tags.mjs

import "dotenv/config";

const PHONE = "558688720061";
const TAG = "[EC] Pedido Pago";

async function main() {
  // Usa o /dist (que foi rebuildado com as últimas edições).
  const { ShotzapProvider } = await import("../dist/modules/automation/channels/shotzap/provider.js");

  const fs = await import("fs/promises");
  const path = await import("path");

  // Load secrets
  const secretsPath = path.join(process.cwd(), "src", "config", "tenants.secrets.json");
  const secrets = JSON.parse(await fs.readFile(secretsPath, "utf-8"));
  const token = typeof secrets.lumi === "string" ? secrets.lumi : secrets.lumi?.token;
  if (!token) {
    console.error("❌ Sem token de lumi em tenants.secrets.json");
    process.exit(1);
  }

  const provider = new ShotzapProvider({
    baseUrl: "https://api.shotzap.com.br",
    token,
    tagsCachePath: "src/tenants/lumi/tags_cache.json",
    paths: {
      sendText: "/api/messages/send",
      addTag: "/api/tags/add",
      getTickets: "/api/contacts/alltickets"
    }
  });

  console.log("\n=== 1. Aguardando cache de tags carregar... ===");
  // Força o load do cache
  await new Promise((r) => setTimeout(r, 2000));

  console.log("\n=== 2. getContactTags ANTES do addTag ===");
  const before = await provider.getContactTags(PHONE);
  console.log("tags ANTES:", before);
  console.log("tem Pago?", before.some((t) => t.toLowerCase().includes("pedido pago")));

  console.log("\n=== 3. addTag ===");
  const addResult = await provider.addTag({ tag: TAG, number: PHONE });
  console.log("resultado addTag:", JSON.stringify(addResult, null, 2));

  console.log("\n=== 4. Aguardando 1s... ===");
  await new Promise((r) => setTimeout(r, 1000));

  console.log("\n=== 5. getContactTags DEPOIS do addTag ===");
  const after = await provider.getContactTags(PHONE);
  console.log("tags DEPOIS:", after);
  console.log("tem Pago?", after.some((t) => t.toLowerCase().includes("pedido pago")));

  console.log("\n=== DIAGNÓSTICO ===");
  if (after.some((t) => t.toLowerCase() === TAG.toLowerCase())) {
    console.log("✅ addTag funcionou. Problema está em outro lugar.");
  } else if (after.length === 0) {
    console.log("❌ getContactTags retorna vazio — problema é na leitura das tags");
  } else {
    console.log("❌ Tags retornadas mas sem a Pago:", after);
    console.log("   Pode ser: addTag falhou silenciosamente OU case mismatch");
  }
}

main().catch((e) => {
  console.error("ERR:", e);
  process.exit(1);
});
