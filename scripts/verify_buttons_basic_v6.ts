import axios from "axios";
import fs from "fs-extra";
import path from "path";

// Configuração manual para teste isolado
const BASE_URL = "https://api.shotzap.com.br";
const TOKEN = "8FDQaIe82xmGwB3tuAIMxqp58SQydwn9nXDkrkvupLLc44rc4HDbRoDRoNfgdLty5"; 
const PHONE = "5586995336923"; 

async function testButtonsBasic() {
  console.log("=== TESTE DE BOTÕES - API QUICK REPLY BÁSICA (sendBTN2) ===");
  
  const endpoint = "/api/messages/sendBTN2";
  const url = `${BASE_URL}${endpoint}`;

  // Payload conforme documentação: https://ajuda.shotzap.com.br/principal/apis/botoes-no-whatsapp/botao-quick-reply-api/
  const payload = {
    number: PHONE,
    customData: {
        body: "Teste de Quick Reply API Básica (sendBTN2)",
        name: "quick_reply",
        params: JSON.stringify({
            display_text: "Sim (Básico)",
            id: "opt_un",
            disabled: false
        }),
        nameb: "quick_reply",
        paramsb: JSON.stringify({
            display_text: "Não (Básico)",
            id: "opt_deux",
            disabled: false
        })
    }
  };

  console.log(`Enviando POST para: ${url}`);
  console.log("Payload:", JSON.stringify(payload, null, 2));

  try {
    const response = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TOKEN}`
      }
    });

    console.log("✅ Sucesso! Resposta:", response.data);
  } catch (error: any) {
    console.error("❌ Erro na requisição:");
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error("Data:", error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

testButtonsBasic();