import axios from "axios";

// Configuração
const BASE_URL = "https://api.shotzap.com.br";
// Endpoint confirmado na documentação: https://ajuda.shotzap.com.br/principal/apis/botoes-no-whatsapp/api-botao-copia-e-cola-pro/
const PRO_ENDPOINT = "/api/messages/whatsmeow/sendButtonsPRO"; 
const TOKEN = "8FDQaIe82xmGwB3tuAIMxqp58SQydwn9nXDkrkvupLLc44rc4HDbRoDRoNfgdLty5"; 
const PHONE = "558695336923"; 

async function testCopyButtonProOfficial() {
  console.log("=== TESTE OFICIAL DE COPY BUTTON (PRO) ===");
  const url = `${BASE_URL}${PRO_ENDPOINT}`;

  // Payload EXATAMENTE conforme a documentação "API Botão Copia e Cola Pro"
  // buttons: [{ type: "copy", text: "...", code: "..." }]
  
  const payload = {
    openTicket: 0,
    body: [
      {
        phone: PHONE,
        title: "Teste Oficial Copy Pro",
        body: "Teste usando a documentação oficial da API Copia e Cola Pro",
        footer: "Shot-Tray Test",
        buttons: [
          {
            type: "copy",
            text: "Copiar PIX",
            code: "13959856000130" // DOC diz 'code', não 'copy_code' !!!
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
    console.log("✅ Sucesso (API Aceitou):", res.data);
  } catch (err: any) {
    console.log("❌ Falha:", err.response?.data || err.message);
  }
}

testCopyButtonProOfficial();