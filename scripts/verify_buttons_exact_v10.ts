import axios from "axios";

// Configuração
const BASE_URL = "https://api.shotzap.com.br";
// const PRO_ENDPOINT = "/api/messages/whatsmeow/sendButtonsPRO"; // COMENTADO para provar o ponto
const TOKEN = "8FDQaIe82xmGwB3tuAIMxqp58SQydwn9nXDkrkvupLLc44rc4HDbRoDRoNfgdLty5"; 
const PHONE = "5586995336923"; 

async function testExactUserSnippet() {
  console.log("=== TESTE EXATO DO SNIPPET FORNECIDO (sendCopyPaste) ===");

  // Payload EXATAMENTE igual ao fornecido, apenas substituindo vars
  let data = JSON.stringify({
    "number": PHONE,
    "customData": {
      "body": "Teste Exato do Snippet (Porra)",
      "name": "cta_copy",
      "params": JSON.stringify({
          "display_text": "Copiar PIX",
          "copy_code": "13959856000130",
          "disabled": false
      })
    }
  });

  let config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `${BASE_URL}/api/messages/sendCopyPaste`,
    headers: { 
      'Content-Type': 'application/json', 
      'Authorization': `Bearer ${TOKEN}`
    },
    data : data
  };

  console.log(`Enviando POST para ${config.url}`);
  console.log("Data:", data);

  try {
      const response = await axios.request(config);
      console.log("✅ RESPOSTA SUCESSO:", JSON.stringify(response.data));
  } catch (error: any) {
      console.log("❌ RESPOSTA ERRO:", error.response?.data || error.message);
  }
}

testExactUserSnippet();