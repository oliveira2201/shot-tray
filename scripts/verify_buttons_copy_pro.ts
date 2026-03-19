import axios from "axios";

// Configuração
const BASE_URL = "https://api.shotzap.com.br";
const PRO_ENDPOINT = "/api/messages/whatsmeow/sendButtonsPRO";
const TOKEN = "8FDQaIe82xmGwB3tuAIMxqp58SQydwn9nXDkrkvupLLc44rc4HDbRoDRoNfgdLty5"; 
const PHONE = "5586995336923"; 

async function testCopyButtonPro() {
  console.log("=== TESTE DE BOTÃO COPIAR (API PRO) ===");
  const url = `${BASE_URL}${PRO_ENDPOINT}`;

  // Tentativa 1: Usando 'type: copy' dentro da estrutura SendButtonsPRO
  const payloadPro = {
    openTicket: 0,
    body: [
      {
        phone: PHONE,
        title: "Teste Copy Button",
        body: "Teste de botão de copiar (Pix)",
        footer: "Shot-Tray Test",
        buttons: [
          {
            type: "copy", // Chute educado baseado em padroes (ou 'cta_copy')
            text: "Copiar Chave Pix",
            copy_code: "13959856000130"
          },
          {
             type: "quick_reply",
             text: "Confirmar",
             id: "conf_pix"
          }
        ]
      }
    ]
  };

  console.log("Enviando Payload PRO (Tentativa 1 - type: copy):", JSON.stringify(payloadPro, null, 2));

  try {
    const res = await axios.post(url, payloadPro, {
      headers: { "Authorization": `Bearer ${TOKEN}` }
    });
    console.log("✅ Sucesso (Pro - Copy):", res.data);
  } catch (err: any) {
    console.log("❌ Falha (Pro - Copy):", err.response?.data || err.message);
  }
}

testCopyButtonPro();