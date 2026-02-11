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
    const token = tenant.config.token;
    const baseUrl = tenant.config.baseUrl.replace(/\/$/, "");
    const sendTextPath = tenant.config.paths.sendText || "/messages/send-text";
    const url = baseUrl + (sendTextPath.startsWith("/") ? sendTextPath : "/" + sendTextPath);
    const targetNumber = process.argv[2] || "5511999999999"; 

    console.log(`Target URL: ${url}`);

    const testCases = [
        {
            name: "Nest 1: data.phone",
            payload: { data: { phone: targetNumber, message: "Test phone" } }
        },
        {
            name: "Nest 2: data.id",
            payload: { data: { id: targetNumber, message: "Test id" } }
        },
        {
            name: "Nest 3: data.to",
            payload: { data: { to: targetNumber, message: "Test to" } }
        },
        {
            name: "Nest 4: data.jid",
            payload: { data: { jid: targetNumber, message: "Test jid" } }
        },
        {
             name: "Nest 5: data.number (Int)",
             payload: { data: { number: Number(targetNumber), message: "Test int" } }
        },
        {
            name: "Nest 6: data.remoteJid",
            payload: { data: { remoteJid: targetNumber + "@s.whatsapp.net", message: "Test remoteJid" } }
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
