
import axios from 'axios';
import tenants from '../src/config/tenants.json';

const tenant = tenants.find(t => t.id === 'ebenezer');
if (!tenant) throw new Error("Tenant ebenezer not found");

const config = tenant.config;

// Configurações
const PHONE = "5586995336923"; 
const LEGACY_TOKEN = config.token;

const client = axios.create({
    baseURL: config.baseUrl,
    validateStatus: () => true 
});

async function testLookupSingle(token: string) {
    console.log(`\n--- Testando Lookup Single (/api/contacts/single?number=${PHONE}) ---`);
    try {
        const res = await client.get(`/api/contacts/single?number=${PHONE}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`Status: ${res.status}`);
        if(res.data) console.log(`Response:`, JSON.stringify(res.data).substring(0, 200));
        
        // Verifica se a resposta não é html (erro comum 404/500 mascarado)
        if (typeof res.data === 'string' && res.data.includes('<!DOCTYPE html>')) {
             console.log("ALERTA: Resposta é HTML (possível erro de endpoint)");
        }
        
        return res.data?.id;
    } catch (e: any) {
        console.log(`Erro: ${e.message}`);
    }
}

async function testLookupList(token: string) {
    console.log(`\n--- Testando Lookup List (/api/contacts?number=${PHONE}) ---`);
    try {
        const res = await client.get(`/api/contacts`, {
            params: { number: PHONE },
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`Status: ${res.status}`);
        // Loga mais detalhes se for objeto
        if(res.data) console.log(`Response sample:`, JSON.stringify(res.data).substring(0, 200));
        
        const list = Array.isArray(res.data) ? res.data : (res.data?.contacts || []);
        console.log(`Itens na lista: ${list.length}`);
        
        const found = list.find((c: any) => c.number == PHONE || c.phone == PHONE);
        if (found) console.log("Encontrado na lista:", found.id);
        else console.log("NÃO encontrado na lista");
        
        return found?.id;
    } catch (e: any) {
        console.log(`Erro: ${e.message}`);
    }
}

async function testContactCreation(token: string) {
    console.log(`\n--- Testando Criação (/api/contacts) ---`);
    const payload = {
        name: `Teste Script`,
        number: PHONE,
        email: "",
        userId: 854
    };
    try {
        const res = await client.post(`/api/contacts`, payload, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`Status: ${res.status}`);
        if(res.data) console.log(`Response:`, JSON.stringify(res.data).substring(0, 200));
        
        if (res.data?.id) return res.data.id;
        if (res.data?.existingContact?.id) return res.data.existingContact.id;
    } catch(e: any) {
        console.log(`Erro: ${e.message}`);
    }
}

async function run() {
    console.log("=== DIAGNÓSTICO DE CONTATO (LEGACY TOKEN) ===");
    
    await testLookupSingle(LEGACY_TOKEN);
    await testLookupList(LEGACY_TOKEN);
    await testContactCreation(LEGACY_TOKEN);
}

run();
