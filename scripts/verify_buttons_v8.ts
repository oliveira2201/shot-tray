import axios from "axios";

const BASE_URL = "https://api.shotzap.com.br";
const TOKEN = "8FDQaIe82xmGwB3tuAIMxqp58SQydwn9nXDkrkvupLLc44rc4HDbRoDRoNfgdLty5"; 
const PHONE = "5586995336923"; 

async function testButtonsLegacyExplicit() {
  console.log("=== TESTE RIGOROSO SEND BTN2 (BASIC) ===");
  const url = `${BASE_URL}/api/messages/sendBTN2`;

  // Construindo o payload exatamente como no PHP
  const rawPayload = {
    number: PHONE,
    customData: {
      body: "Teste Rigoroso V8",
      name: "quick_reply",
      params: JSON.stringify({
        display_text: "Opcao A",
        id: "id_botao_A",
        disabled: false
      }),
      nameb: "quick_reply",
      paramsb: JSON.stringify({
        display_text: "Opcao B",
        id: "id_botao_B",
        disabled: false
      })
    }
  };

  console.log("Payload sendo enviado:", JSON.stringify(rawPayload, null, 2));

  try {
    const response = await axios.post(url, rawPayload, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${TOKEN}`
      }
    });
    console.log("✅ RESPONSE:", response.data);
  } catch (error: any) {
    if (error.response) {
       console.log("❌ ERROR STATUS:", error.response.status);
       console.log("❌ ERROR DATA:", error.response.data);
    } else {
       console.log("❌ ERROR:", error.message);
    }
  }
}

testButtonsLegacyExplicit();