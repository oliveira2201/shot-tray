import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
    const configPath = path.resolve(__dirname, "../src/config/tenants.json");
    const rawConfig = fs.readFileSync(configPath, 'utf-8');
    const tenants = JSON.parse(rawConfig);
    const tenant = tenants.find(t => t.id === 'ebenezer');

    if (!tenant) {
        console.error("Tenant not found");
        return;
    }

    const token = tenant.config.token;
    // Fix baseUrl/path join
    const baseUrl = tenant.config.baseUrl.replace(/\/$/, "");
    const sendTextPath = tenant.config.paths.sendText || "/messages/send-text";
    const url = baseUrl + (sendTextPath.startsWith("/") ? sendTextPath : "/" + sendTextPath);

    console.log(`Target URL: ${url}`);
    
    // Default number to test or allow override
    const targetNumber = process.argv[2] || "5511999999999"; 

    const testCases = [
        {
            name: "Structure 1: Flat number/message",
            payload: { number: targetNumber, message: "Test 1" }
        },
        {
            name: "Structure 2: Nested data",
            payload: { data: { number: targetNumber, message: "Test 2" } }
        },
        {
            name: "Structure 3: Flat phone/message",
            payload: { phone: targetNumber, message: "Test 3" }
        },
         {
            name: "Structure 4: openTicket/body with number",
            payload: { 
                openTicket: 0, 
                body: [ { number: targetNumber, message: "Test 4" } ] 
            }
        },
        {
            name: "Structure 5: openTicket/body with phone (Original)",
            payload: { 
                openTicket: 0, 
                body: [ { phone: targetNumber, message: "Test 5" } ] 
            }
        },
        {
            name: "Structure 6: Flat number/text (Whatsmeow common)",
            payload: { number: targetNumber, text: "Test 6" }
        },
        {
             name: "Structure 7: Flat phone/text (Whatsmeow common)",
             payload: { phone: targetNumber, text: "Test 7" }
        }
    ];

    for (const test of testCases) {
        console.log(`\n--- Testing ${test.name} ---`);
        console.log(`Payload: ${JSON.stringify(test.payload)}`);
        try {
            const res = await axios.post(url, test.payload, {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });
            console.log(`✅ Success! Status: ${res.status}`);
            console.log(`Response: ${JSON.stringify(res.data)}`);
            // If success, we found it!
        } catch (err) {
            console.log(`❌ Failed. Status: ${err.response?.status}`);
            console.log(`Error Data: ${JSON.stringify(err.response?.data)}`);
        }
    }
}

run();
