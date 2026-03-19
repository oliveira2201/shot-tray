import axios from "axios";

// Configuração manual para teste isolado
const BASE_URL = "https://api.shotzap.com.br";
const TOKEN = "8FDQaIe82xmGwB3tuAIMxqp58SQydwn9nXDkrkvupLLc44rc4HDbRoDRoNfgdLty5"; // Legacy Token do arquivo tenants.json
const PHONE = "5586995336923"; 

async function testButtonsPro() {
  console.log("=== TESTE DE BOTÕES - API PRO (WhatsMeow) ===");
  
  const endpoint = "/api/messages/whatsmeow/sendButtonsPRO";
  const url = `${BASE_URL}${endpoint}`;

  const payload = {
    openTicket: 0,
    body: [
      {
        phone: PHONE,
        title: "Teste API Pro",
        body: "Testando envio de botões mistos (URL + Quick Reply)",
        footer: "Shotzap Bot Test",
        buttons: [
          {
             type: "quick_reply",
             text: "Opção 1",
             id: "opt_1"
          },
          {
             type: "quick_reply",
             text: "Opção 2",
             id: "opt_2"
          }
        ]
      }
    ]
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

testButtonsPro();
