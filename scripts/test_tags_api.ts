import axios from "axios";

const BASE_URL = "https://api.shotzap.com.br";
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2FybmFtZSI6IkZlbGlwZSBBcmHDumpvIGRlIEFsY8OibnRhcmEgT2xpdmVpcmEiLCJwcm9maWxlIjoiYWRtaW4iLCJpZCI6ODU0LCJjb21wYW55SWQiOjIyMywiaWF0IjoxNzcwODMyNTE4LCJleHAiOjE3NzM0MjQ1MTh9.1FmHc6lq87NUao9QnUaPcIdXuOIhOUK0gIeS8_tF2_w";

async function testCreateTag() {
  console.log("🧪 Testando API de criação de tags...\n");

  const payload = {
    name: "Teste1",
    color: "#2196f3",
    kanban: 0,
    prioridade: 0,
    conversao: "",
    automation: 0,
    flowsId: null,
    tagType: "Atendimento",
    weekends: 0,
    userId: 854
  };

  console.log("📤 Payload:");
  console.log(JSON.stringify(payload, null, 2));
  console.log("\n🔗 URL:", `${BASE_URL}/tags`);
  console.log("🔑 Token:", TOKEN.substring(0, 20) + "...");

  try {
    const response = await axios.post(`${BASE_URL}/tags`, payload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`
      }
    });

    console.log("\n✅ Sucesso!");
    console.log("📥 Status:", response.status);
    console.log("📥 Resposta:");
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.log("\n❌ Erro!");
    if (error.response) {
      console.log("📥 Status:", error.response.status);
      console.log("📥 Mensagem:", error.response.statusText);
      console.log("📥 Dados:");
      console.log(JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.log("❌ Nenhuma resposta recebida");
      console.log("Detalhes:", error.message);
    } else {
      console.log("❌ Erro ao configurar request:", error.message);
    }
  }
}

testCreateTag();
