import axios from 'axios';

const token = "8FDQaIe82xmGwB3tuAIMxqp58SQydwn9nXDkrkvupLLc44rc4HDbRoDRoNfgdLty2";
const baseUrl = "https://api.shotzap.com.br";

const api = axios.create({
    baseURL: baseUrl,
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
});

async function explore() {
    console.log("=== VERIFICANDO TOKEN E ENDPOINTS ===");

    // 2. Tentar Add Tag com Payload Invalido (esperamos 500, nao 403)
    try {
        console.log("\nTestando Add Tag (esperando 500)...");
        await api.post('/api/tags/add', {
            phone: "5586995336923",
            tag: "Teste"
        });
    } catch (error) {
        console.log("AddTag Resultado:", error.response ? error.response.status : error.message);
        if (error.response && error.response.data) {
             console.log("Erro Dados:", JSON.stringify(error.response.data));
        }
    }

    // 3. Tentar Listar Tickets novamente
    try {
        console.log("\nTentando listar tickets...");
        const res = await api.get('/api/tickets');
        console.log("Tickets status:", res.status);
    } catch (error) {
        console.log("Get Tickets erro:", error.response ? error.response.status : error.message);
         if (error.response) console.log(JSON.stringify(error.response.data));
    }
    

    let ticketId = 0;


    // 6. Obter Tickets do Contato (Documentação nova)
    try {
        console.log("\nTentando GET /api/contacts/alltickets...");
        const res = await api.get('/api/contacts/alltickets', {
            data: {
                "number": "5586995336923"
            }
        }); 
        console.log("GET AllTickets status:", res.status);
        
        // Log Headers to check for new token
        console.log("HEADERS:", JSON.stringify(res.headers, null, 2));

        if (Array.isArray(res.data) && res.data.length > 0) {
            ticketId = res.data[0].id; 
            console.log("Ticket ID Encontrado:", ticketId);
        }
    } catch (error) {
         console.log("GET AllTickets erro:", error.response ? error.response.status : error.message);
    }


    // 8. Tentar Listar Tags Novamente (Talvez agora vá?)
    let tagId = 0;
    try {
        console.log("\nTentando GET /api/tags...");
        const res = await api.get('/api/tags');
        console.log("GET Tags status:", res.status);
        console.log("GET Tags data (excerpt):", JSON.stringify(res.data).substring(0, 200));
        if (Array.isArray(res.data) && res.data.length > 0) {
            tagId = res.data[0].id;
             console.log("Tag ID Exemplo:", tagId);
        }
    } catch (error) {
        console.log("GET Tags erro:", error.response ? error.response.status : error.message);
        if (error.response) console.log(JSON.stringify(error.response.data));
    }

    // 9. Se tivermos Ticket ID e Tag ID (mesmo chutado, vou chutar 1 se nao tiver), Tentar Add Tag
    if (ticketId > 0) {
        const targetTagId = tagId > 0 ? tagId : 1;
        console.log(`\nTentando adicionar Tag ID ${targetTagId} ao Ticket ${ticketId}...`);
        
        try {
            const payload = {
                "ticketId": ticketId,
                "tags": [
                    { "id": targetTagId }
                ]
            };
            const res = await api.post('/api/tags/add', payload);
            console.log("ADD TAG Sucesso:", res.status);
            console.log(JSON.stringify(res.data, null, 2));

        } catch (error) {
             console.log("ADD TAG Erro:", error.response ? error.response.status : error.message);
             if (error.response) console.log(JSON.stringify(error.response.data));
        }
    }

}

explore();
