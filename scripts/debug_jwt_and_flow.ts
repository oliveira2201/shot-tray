import axios from "axios";

const LEGACY_TOKEN = "8FDQaIe82xmGwB3tuAIMxqp58SQydwn9nXDkrkvupLLc44rc4HDbRoDRoNfgdLty5";
const JWT_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2FybmFtZSI6IkZlbGlwZSBBcmHDumpvIGRlIEFsY8OibnRhcmEgT2xpdmVpcmEiLCJwcm9maWxlIjoiYWRtaW4iLCJpZCI6ODU0LCJjb21wYW55SWQiOjIyMywiaWF0IjoxNzcwODMyNTE4LCJleHAiOjE3NzM0MjQ1MTh9.1FmHc6lq87NUao9QnUaPcIdXuOIhOUK0gIeS8_tF2_w";
const PHONE = "5586995336923"; // Número dos testes anteriores
const TAG_NAME = "[EBE] Debug Tag 1";

async function runDebug() {
    console.log("=== DEBUG JWT & FLOW ===");

    // 1. Testar JWT (Listar Tags)
    console.log("\n1. Testando JWT (Listar Tags)...");
    try {
        const res = await axios.get("https://api.shotzap.com.br/tags", {
            headers: { Authorization: `Bearer ${JWT_TOKEN}` }
        });
        console.log(`✅ JWT OK! Tags encontradas: ${res.data.tags?.length || 0}`);
        
        // Verificar se a tag já existe
        const existing = res.data.tags?.find((t: any) => t.name === TAG_NAME);
        if (existing) {
            console.log(`ℹ️ Tag '${TAG_NAME}' já existe com ID: ${existing.id}`);
        } else {
            console.log(`ℹ️ Tag '${TAG_NAME}' não encontrada.`);
        }
    } catch (e: any) {
        console.log(`❌ JWT FALHOU (GET): ${e.response?.status} - ${JSON.stringify(e.response?.data)}`);
    }

    // 2. Testar JWT (Criar Tag)
    console.log("\n2. Testando JWT (Criar Tag)...");
    let tagId: number | null = null;
    try {
        const payload = {
            name: TAG_NAME,
            color: "#5f6368",
            kanban: 0,
            prioridade: 0,
            automation: 0,
            tagType: "Atendimento",
            weekends: 0,
            userId: 854
        };
        const res = await axios.post("https://api.shotzap.com.br/tags", payload, {
            headers: { Authorization: `Bearer ${JWT_TOKEN}` }
        });
        tagId = res.data?.id || res.data?.data?.id;
        console.log(`✅ Criação OK! ID: ${tagId}`);
    } catch (e: any) {
         console.log(`❌ JWT FALHOU (POST): ${e.response?.status} - ${JSON.stringify(e.response?.data)}`);
    }

    // 3. Testar Envio de Mensagem (Legacy) - Tentar abrir ticket
    console.log("\n3. Testando Mensagem (Legacy) com openTicket=1...");
    try {
        const msgPayload = {
            number: PHONE,
            body: "Teste de Debug Flow - Criando Ticket",
            openTicket: "1" // Tentar forçar abertura de ticket
        };
        const res = await axios.post("https://api.shotzap.com.br/api/messages/send", msgPayload, {
             headers: { Authorization: `Bearer ${LEGACY_TOKEN}` }
        });
        console.log(`✅ Mensagem OK! Ticket ID: ${res.data?.ticketId || '?'}`);
    } catch (e: any) {
        console.log(`❌ Mensagem FALHOU: ${e.response?.status} - ${JSON.stringify(e.response?.data)}`);
    }

    // 4. Testar Atribuição de Tag (Legacy)
    if (tagId) {
        console.log(`\n4. Testando Atribuição de Tag ID ${tagId} (Legacy)...`);
        try {
            const tagPayload = {
                number: PHONE,
                tagId: tagId,
                tagIds: [tagId]
            };
            const res = await axios.post("https://api.shotzap.com.br/api/tags/add", tagPayload, {
                 headers: { Authorization: `Bearer ${LEGACY_TOKEN}` }
            });
            console.log(`✅ Atribuição OK! ${JSON.stringify(res.data)}`);
        } catch (e: any) {
            console.log(`❌ Atribuição FALHOU: ${e.response?.status} - ${JSON.stringify(e.response?.data)}`);
        }
    } else {
        console.log("\n⚠️ Ppulando atribuição (sem ID de tag).");
    }
}

runDebug();
