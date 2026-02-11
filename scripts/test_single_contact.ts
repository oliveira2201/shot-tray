
import axios from 'axios';
import tenants from '../src/config/tenants.json';

const tenant = tenants.find(t => t.id === 'ebenezer');
if (!tenant) throw new Error("Tenant ebenezer not found");

const config = tenant.config;
const PHONE = "5586995336923"; 
const LEGACY_TOKEN = config.token;

const client = axios.create({
    baseURL: config.baseUrl,
    validateStatus: () => true 
});

async function run() {
    console.log("=== TESTE GET CONTACT SINGLE (BODY vs QUERY) ===");

    // Teste 1: Query Param (O que estávamos fazendo)
    console.log("\n1. Teste Query Params: GET /api/contacts/single?number=...");
    try {
        const res = await client.get(`/api/contacts/single`, {
            params: { number: PHONE },
            headers: { Authorization: `Bearer ${LEGACY_TOKEN}` }
        });
        console.log(`Status: ${res.status}`);
        if(res.data) console.log(`Response:`, JSON.stringify(res.data).substring(0, 200));
    } catch(e: any) { console.log(e.message); }

    // Teste 2: Body JSON (O que a doc sugere)
    console.log("\n2. Teste Body JSON: GET /api/contacts/single + data");
    try {
        const res = await client.request({
            method: 'GET',
            url: `/api/contacts/single`,
            data: { number: PHONE },
            headers: { Authorization: `Bearer ${LEGACY_TOKEN}` }
        });
        console.log(`Status: ${res.status}`);
        if(res.data) console.log(`Response:`, JSON.stringify(res.data).substring(0, 200));
    } catch(e: any) { console.log(e.message); }

    // Teste 3: POST (Caso a doc esteja errada sobre o método, mas certa sobre body)
    console.log("\n3. Teste POST: POST /api/contacts/single + data");
    try {
        const res = await client.post(`/api/contacts/single`, { number: PHONE }, {
            headers: { Authorization: `Bearer ${LEGACY_TOKEN}` }
        });
        console.log(`Status: ${res.status}`);
        if(res.data) console.log(`Response:`, JSON.stringify(res.data).substring(0, 200));
    } catch(e: any) { console.log(e.message); }
}

run();
