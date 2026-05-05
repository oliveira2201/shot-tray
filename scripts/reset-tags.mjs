// Remove tags do contato de teste pra permitir um teste limpo.
// Não envia nenhuma mensagem WhatsApp — só chama removeTag via API.
//
// Uso: node scripts/reset-tags.mjs

import fs from "fs/promises";
import path from "path";

const PHONE = "558688720061";
const TAGS_TO_REMOVE = [
  "[EC] Pedido Pago",
  "[EC] Pedido Recebido",
  "[EC] Pedido Recebido1",
  "[EC] Pedido Recebido2",
  "[EC] Pedido Recebido3",
  "[EC] Pedido Enviado",
  "[EC] Pedido Entregue",
  "[EC] Pedido Cancelado1",
  "[EC] Pedido Cancelado2",
  "[EC] Pedido Cancelado3",
  "[EC] Pedido Carrinho Abandonado1",
  "[EC] Pedido Carrinho Abandonado2",
  "[EC] Pedido Carrinho Abandonado3",
  "[EC] Cliente",
];

async function main() {
  const { ShotzapProvider } = await import("../dist/modules/automation/channels/shotzap/provider.js");

  const secretsPath = path.join(process.cwd(), "src", "config", "tenants.secrets.json");
  const secrets = JSON.parse(await fs.readFile(secretsPath, "utf-8"));
  const token = typeof secrets.lumi === "string" ? secrets.lumi : secrets.lumi?.token;

  const provider = new ShotzapProvider({
    baseUrl: "https://api.shotzap.com.br",
    token,
    tagsCachePath: "src/tenants/lumi/tags_cache.json",
    paths: {
      sendText: "/api/messages/send",
      addTag: "/api/tags/add",
      getTickets: "/api/contacts/alltickets",
    },
  });

  await new Promise((r) => setTimeout(r, 1500));

  console.log("\n=== Tags ANTES ===");
  const before = await provider.getContactTags(PHONE);
  console.log(before);

  console.log("\n=== Removendo tags ===");
  for (const tag of TAGS_TO_REMOVE) {
    if (before.includes(tag)) {
      console.log(`  - ${tag}`);
      try {
        await provider.removeTag({ tag, number: PHONE });
      } catch (e) {
        console.warn(`    erro: ${e.message}`);
      }
    }
  }

  await new Promise((r) => setTimeout(r, 1500));

  console.log("\n=== Tags DEPOIS ===");
  const after = await provider.getContactTags(PHONE);
  console.log(after);

  if (after.length === 0) {
    console.log("\n✅ Contato limpo, pronto pra teste");
  } else {
    console.log(`\n⚠️ Ainda sobraram ${after.length} tag(s)`);
  }
}

main().catch((e) => {
  console.error("ERR:", e);
  process.exit(1);
});
