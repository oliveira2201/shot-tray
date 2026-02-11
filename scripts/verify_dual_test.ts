import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
    try {
        const configPath = path.resolve(__dirname, "../src/config/tenants.json");
        const rawConfig = fs.readFileSync(configPath, 'utf-8');
        const tenants = JSON.parse(rawConfig);
        const tenant = tenants.find((t:any) => t.id === 'ebenezer');

        if (!tenant) {
            console.error("Tenant 'ebenezer' not found in config.");
            process.exit(1);
        }

        const config = tenant.config;
        const targetNumber = "5586995336923"; 
        const baseUrl = config.baseUrl.replace(/\/$/, "");

        console.log("=== TESTE DUAL ===");
        console.log(`Target: ${targetNumber}`);

        // --- TEST 1: SEND TEXT ---
        console.log("\n1. Teste Send Text (/api/messages/send)");
        const sendTextUrl = baseUrl + "/api/messages/send";
        const textPayload = {
            openTicket: "0",
            number: targetNumber,
            body: "Teste 1: Texto Simples via /api/messages/send 🚀"
        };
        
        try {
            console.log(`POST ${sendTextUrl}`);
            const resText = await axios.post(sendTextUrl, textPayload, {
                headers: { "Authorization": `Bearer ${config.token}` }
            });
            console.log("✅ Text Response Status:", resText.status);
            console.log("Response:", JSON.stringify(resText.data, null, 2));
        } catch (err: any) {
            console.error("❌ Text Error:", err.message);
            if (err.response) console.error(JSON.stringify(err.response.data, null, 2));
        }

        // --- TEST 2: SEND BUTTONS ---
        console.log("\n2. Teste Send Buttons (/api/messages/whatsmeow/sendButtonsPRO)");
        const sendButtonsUrl = baseUrl + "/api/messages/whatsmeow/sendButtonsPRO";
        const buttonsPayload = {
            openTicket: "0",
            body: [
                {
                    phone: targetNumber,
                    title: "Teste 2: Botões PRO",
                    body: "Teste de envio de botões via API whatsmeow.",
                    footer: "Rodapé",
                    buttons: [
                        {
                            type: "url",
                            text: "Google",
                            url: "https://google.com"
                        }
                    ]
                }
            ]
        };

        try {
            console.log(`POST ${sendButtonsUrl}`);
            const resBtn = await axios.post(sendButtonsUrl, buttonsPayload, {
                headers: { "Authorization": `Bearer ${config.token}` }
            });
            console.log("✅ Button Response Status:", resBtn.status);
            console.log("Response:", JSON.stringify(resBtn.data, null, 2));
        } catch (err: any) {
            console.error("❌ Button Error:", err.message);
            if (err.response) console.error(JSON.stringify(err.response.data, null, 2));
        }

    } catch (error: any) {
        console.error("Global Error:", error.message);
    }
}

run();
