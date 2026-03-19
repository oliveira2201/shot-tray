import axios from "axios";

// Configuração
const BASE_URL = "https://api.shotzap.com.br";
const TOKEN = "8FDQaIe82xmGwB3tuAIMxqp58SQydwn9nXDkrkvupLLc44rc4HDbRoDRoNfgdLty5"; 
const PHONE = "5586995336923"; 

async function testUserExactModel() {
  console.log("=== TESTE MODELO EXATO DO USUÁRIO (sendCopyPaste) ===");
  const url = `${BASE_URL}/api/messages/sendCopyPaste`;

  const payload = {
    number: PHONE,
    customData: {
      body: "Teste Modelo Exato (sendCopyPaste)",
      name: "cta_copy",
      params: JSON.stringify({
        display_text: "Copiar Codigo",
        id: "btn_copy_1",
        copy_code: "12345678900",
        disabled: false
      })
    }
  };

  console.log(`POST ${url}`);
  console.log("Payload:", JSON.stringify(payload, null, 2));

  try {
    const res = await axios.post(url, payload, {
      headers: { 
          "Authorization": `Bearer ${TOKEN}`,
          "Content-Type": "application/json"
      }
    });
    console.log("✅ Sucesso (sendCopyPaste):", res.data);
  } catch (err: any) {
    console.log("❌ Falha (sendCopyPaste):", err.response?.data || err.message);
  }
}

async function testProWithCtaCopyType() {
    console.log("\n=== TESTE PRO ALTERNATIVO (type: cta_copy) ===");
    const url = `${BASE_URL}/api/messages/whatsmeow/sendButtonsPRO`;

    const payload = {
      openTicket: 0,
      body: [
        {
          phone: PHONE,
          title: "Teste Pro CTA",
          body: "Teste com type: cta_copy (baseado no snippet)",
          footer: "Rodapé",
          buttons: [
            {
              type: "cta_copy", // Tentando 'cta_copy' em vez de 'copy'
              text: "Copiar PIX",
              copy_code: "999888777", // Campo direto
              id: "btn_pro_copy"
            }
          ]
        }
      ]
    };

    console.log(`POST ${url}`);
    console.log("Payload:", JSON.stringify(payload, null, 2));

    try {
        const res = await axios.post(url, payload, {
          headers: { "Authorization": `Bearer ${TOKEN}` }
        });
        console.log("✅ Sucesso (Pro cta_copy):", res.data);
      } catch (err: any) {
        console.log("❌ Falha (Pro cta_copy):", err.response?.data || err.message);
      }
}

async function run() {
    // 1. Tenta o modelo exato do usuário
    await testUserExactModel();

    // 2. Tenta adaptar para PRO com type diferente
    await testProWithCtaCopyType();
}

run();