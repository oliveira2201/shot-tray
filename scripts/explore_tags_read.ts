import axios from "axios";

// USING THE JWT TOKEN that worked
const TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2FybmFtZSI6IkZlbGlwZSBBcmHDumpvIGRlIEFsY8OibnRhcmEgT2xpdmVpcmEiLCJwcm9maWxlIjoiYWRtaW4iLCJpZCI6ODU0LCJjb21wYW55SWQiOjIyMywiaWF0IjoxNzcwODMyNTE4LCJleHAiOjE3NzM0MjQ1MTh9.1FmHc6lq87NUao9QnUaPcIdXuOIhOUK0gIeS8_tF2_w";
const BASE_URL = "https://api.shotzap.com.br";

async function exploreTags() {
  console.log("🔍 Explorando tags...");
  
  try {
    // 1. Listar tags
    console.log("1️⃣ Listando tags (GET /tags)...");
    const resList = await axios.get(`${BASE_URL}/tags`, {
      headers: { Authorization: `Bearer ${TOKEN}` }
    });
    console.log(`✅ Status: ${resList.status}`);
    console.log("Tipo do data:", typeof resList.data);
    console.log("Conteúdo (primeiros 100 caracteres):", JSON.stringify(resList.data).substring(0, 100));
    console.log("Conteúdo completo:", JSON.stringify(resList.data, null, 2));

    if (Array.isArray(resList.data)) {
        console.log(`Array com ${resList.data.length} itens.`);
    } else if (resList.data.data && Array.isArray(resList.data.data)) {
        console.log(`Objeto com propriedade .data array (${resList.data.data.length} itens).`);
    }

    // 2. Verificar formato de atribuição (addTag)
    // Não vou executar para evitar spam, mas se eu tivesse que chutar:
    // POST /tags/add { ticketId: ?, tagIds: [?] } ou { number: ?, tagId: ? }
    // Vou apenas implementar a lógica de resolução de ID por enquanto.

  } catch (error: any) {
    console.error("❌ Erro:", error.message);
    if (error.response) console.error("Dados:", error.response.data);
  }
}

exploreTags();
