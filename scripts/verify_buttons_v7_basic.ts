import axios from "axios";

// Configuração manual
const BASE_URL = "https://api.shotzap.com.br";
const TOKEN = "8FDQaIe82xmGwB3tuAIMxqp58SQydwn9nXDkrkvupLLc44rc4HDbRoDRoNfgdLty5"; 
const PHONE = "5586995336923"; 

async function testButtonsBasicAttributes() {
  console.log("=== TESTE DE BOTÕES - API SEND BTN2 (BASIC) ===");
  const url = `${BASE_URL}/api/messages/sendBTN2`;

  // Tentativa 1: Payload EXATAMENTE como na documentação (params como string JSON)
  const payloadDoc = {
    number: PHONE,
    customData: {
        body: "Teste: Payload Documentação (String)",
        name: "quick_reply",
        params: JSON.stringify({
            display_text: "Opção A",
            id: "btn_1",
            disabled: false
        }),
        nameb: "quick_reply",
        paramsb: JSON.stringify({
            display_text: "Opção B",
            id: "btn_2",
            disabled: false
        })
    }
  };

  console.log("\n--- Tentativa 1: Params como JSON String ---");
  try {
    const res = await axios.post(url, payloadDoc, {
      headers: { "Authorization": `Bearer ${TOKEN}` }
    });
    console.log("✅ Sucesso (String):", res.data);
  } catch (err: any) {
    console.log("❌ Falha (String):", err.response?.data || err.message);
  }

  // Tentativa 2: Params como Objeto Direto (Caso a doc esteja errada/desatualizada)
  const payloadObj = {
    number: PHONE,
    customData: {
        body: "Teste: Payload Objeto Direto",
        name: "quick_reply",
        params: {
            display_text: "Opção Objet A",
            id: "btn_obj_1",
            disabled: false
        },
        nameb: "quick_reply",
        paramsb: {
            display_text: "Opção Objet B",
            id: "btn_obj_2",
            disabled: false
        }
    }
  };

  console.log("\n--- Tentativa 2: Params como Objeto ---");
  try {
    const res = await axios.post(url, payloadObj, {
      headers: { "Authorization": `Bearer ${TOKEN}` }
    });
    console.log("✅ Sucesso (Objeto):", res.data);
  } catch (err: any) {
    console.log("❌ Falha (Objeto):", err.response?.data || err.message);
  }
}

testButtonsBasicAttributes();