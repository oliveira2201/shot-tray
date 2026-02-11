
import axios from 'axios';
import tenants from '../src/config/tenants.json';

const tenant = tenants.find(t => t.id === 'ebenezer');
if (!tenant) throw new Error("Tenant ebenezer not found");

const config = tenant.config;

// Configurações
const PHONE = "5586995336923"; 
const LEGACY_TOKEN = config.token;
const JWT_TOKEN = config.tagsToken;

const client = axios.create({
    baseURL: config.baseUrl,
    validateStatus: () => true 
});

async function testContact(name: string, token: string, tokenName: string) {
    console.log(`\n--- Testando Contato ${name} [${tokenName}] ---`);
    const url = "/api/contacts";
    const payload = {
        name: `Teste ${tokenName}`,
        number: PHONE,
        email: "",
        userId: 854
    };

    console.log(`URL: ${config.baseUrl}${url}`);
    
    try {
        const res = await client.post(url, payload, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`Status: ${res.status} ${res.statusText}`);
        if(res.data) console.log(`Response:`, JSON.stringify(res.data).substring(0, 200));
        
        if (res.status === 200 || res.status === 201) return res.data.id || res.data.contact?.id;
    } catch (e: any) {
        console.log(`Erro: ${e.message}`);
    }
    return null;
}

async function testTicket(contactId: number, token: string, tokenName: string) {
    console.log(`\n--- Testando Ticket para ContactID ${contactId} [${tokenName}] ---`);
    const url = "/api/tickets/createTicketAPI";
    
    try {
        const res = await client.post(url, { contactId }, {
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`Status: ${res.status} ${res.statusText}`);
        if(res.data) console.log(`Response:`, JSON.stringify(res.data).substring(0, 200));
    } catch (e: any) {
        console.log(`Erro: ${e.message}`);
    }
}

async function run() {
    console.log("Iniciando diagnótico COMPLETO (Contato + Ticket)...");

    // 1. Tentar criar contato com Legacy
    const contactIdLegacy = await testContact("Criação (Legacy)", LEGACY_TOKEN, "Legacy");
    
    // 2. Tentar criar contato com JWT
    const contactIdJwt = await testContact("Criação (JWT)", JWT_TOKEN, "JWT");

    const validContactId = contactIdLegacy || contactIdJwt;
    
    if (validContactId) {
        console.log(`\n>>> Usando Contact ID ${validContactId} para testes de ticket`);
        await testTicket(validContactId, LEGACY_TOKEN, "Legacy");
        await testTicket(validContactId, JWT_TOKEN, "JWT");
    } else {
        console.error("Não foi possível obter um ID de contato válido para prosseguir.");
    }
}

run();
