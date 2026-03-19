import axios from "axios";

// Configuração
const BASE_URL = "https://api.shotzap.com.br";
const PRO_ENDPOINT = "/api/messages/whatsmeow/sendButtonsPRO"; 
const TOKEN = "8FDQaIe82xmGwB3tuAIMxqp58SQydwn9nXDkrkvupLLc44rc4HDbRoDRoNfgdLty5"; 
const PHONE = "558695336923"; 

async function testMixedButtonsPro() {
  console.log("=== TESTE MISTO (COPY + QUICK REPLY) PRO ===");
  const url = `${BASE_URL}${PRO_ENDPOINT}`;

  // "faca igual o 11" -> Mesma estrutura que funcionou
  // "mais o quick reply" -> Adicionando botão quick reply
  
  const payload = {
    openTicket: 0,
    body: [
      {
        // Mantendo o número que funcionou no V11
        phone: PHONE, 
        title: "Teste com o 9",
        body: "Testando botão de Copiar (com parâmetro 'code') junto com Quick Reply.",
        footer: "Shot-Tray Test",
        buttons: [
          {
            type: "quick_reply",
            text: "Já paguei",
            id: "btn_paid"
          },
          {
            type: "quick_reply",
            text: "Falar com Atendente",
            id: "btn_support"
          }
        ]
      }
    ]
  };

  console.log(`Enviando POST para ${url}`);
  console.log("Payload:", JSON.stringify(payload, null, 2));

  try {
    const res = await axios.post(url, payload, {
      headers: { "Authorization": `Bearer ${TOKEN}` }
    });
    console.log("✅ Sucesso (API Aceitou Misto):", JSON.stringify(res.data, null, 2));
  } catch (err: any) {
    console.log("❌ Falha:", err.response?.data || err.message);
  }
}

testMixedButtonsPro();