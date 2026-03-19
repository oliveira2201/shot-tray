import axios from "axios";

// Configuração
const BASE_URL = "https://api.shotzap.com.br";
const PRO_ENDPOINT = "/api/messages/whatsmeow/sendButtonsPRO";
const TOKEN = "8FDQaIe82xmGwB3tuAIMxqp58SQydwn9nXDkrkvupLLc44rc4HDbRoDRoNfgdLty5"; 
const PHONE = "5586995336923"; 

async function testCopyButtonProWithID() {
  console.log("=== TESTE SEND BUTTONS PRO (CORREÇÃO DE PARÂMETROS) ===");
  const url = `${BASE_URL}${PRO_ENDPOINT}`;

  // Adicionando 'id' e testando 'type: cta_copy' vs 'type: copy'
  // Baseado na dica do snippet ("pro is similar")
  
  const payload = {
    openTicket: 0,
    body: [
      {
        phone: PHONE,
        title: "Teste Copy Com ID",
        body: "Teste de botão de copiar COM ID EXPLICITO",
        footer: "Shot-Tray Test",
        buttons: [
          {
            type: "cta_copy", // Usando o nome interno visto no snippet
            display_text: "Copiar Codigo", // Tentando nome de parametro do snippet
            text: "Copiar Codigo (Text)", // Fallback normal
            copy_code: "13959856000130",
            id: "btn_copy_unique_123" // ID ADICIONADO
          },
          {
             type: "quick_reply",
             text: "Confirmar",
             id: "conf_pix_123"
          }
        ]
      }
    ]
  };

  console.log("Enviando Payload PRO (Com ID e params extras):", JSON.stringify(payload, null, 2));

  try {
    const res = await axios.post(url, payload, {
      headers: { "Authorization": `Bearer ${TOKEN}` }
    });
    console.log("✅ Sucesso (Pro - Copy com ID):", res.data);
  } catch (err: any) {
    console.log("❌ Falha (Pro - Copy com ID):", err.response?.data || err.message);
  }
}

testCopyButtonProWithID();