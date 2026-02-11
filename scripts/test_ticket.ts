
import axios from 'axios';
import tenants from '../src/config/tenants.json';

const tenant = tenants.find(t => t.id === 'ebenezer');
if (!tenant) throw new Error("Tenant ebenezer not found");

const config = tenant.config;

// Configurações
const CONTACT_ID = 370484; // ID do contato encontrado no log do usuário
const LEGACY_TOKEN = config.token;
const JWT_TOKEN = config.tagsToken;

const client = axios.create({
    baseURL: config.baseUrl,
    validateStatus: () => true // Não jogar erro, quero ver o status
});

async function testEndpoint(name: string, url: string, token: string, tokenName: string) {
    console.log(`\n--- Testando ${name} [${tokenName}] ---`);
    console.log(`URL: ${config.baseUrl}${url}`);
    
    try {
        const res = await client.post(url, { contactId: CONTACT_ID }, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`Status: ${res.status} ${res.statusText}`);
        if(res.data) console.log(`Response:`, JSON.stringify(res.data).substring(0, 200));
        
        if (res.status === 200 || res.status === 201) {
            console.log(">>> SUCESSO!");
            return true;
        }
    } catch (e: any) {
        console.log(`Erro: ${e.message}`);
    }
    return false;
}

async function run() {
    console.log("Iniciando diagnótico de criação de Ticket...");

    // Teste 1: Endpoint documentado, Token Legacy
    await testEndpoint("Padrão (Legacy)", "/api/tickets/createTicketAPI", LEGACY_TOKEN, "Legacy");

    // Teste 2: Endpoint documentado, Token JWT
    await testEndpoint("Padrão (JWT)", "/api/tickets/createTicketAPI", JWT_TOKEN, "JWT");

    // Teste 3: Sem /api no prefixo
    await testEndpoint("Sem /api (Legacy)", "/tickets/createTicketAPI", LEGACY_TOKEN, "Legacy");
    await testEndpoint("Sem /api (JWT)", "/tickets/createTicketAPI", JWT_TOKEN, "JWT");
    
    // Teste 4: Endpoint RESTful genérico
    await testEndpoint("RESTful /api/tickets (JWT)", "/api/tickets", JWT_TOKEN, "JWT");

}

run();
