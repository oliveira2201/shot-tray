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

        console.log("Testing connection for:", tenant.name);
        
        const config = tenant.config;
        const targetNumber = "5586995336923"; 

        console.log(`Sending REAL BUTTONS test (V2) to: ${targetNumber} ...`);

        const sendButtonsPath = config.paths?.sendButtons || "/api/messages/whatsmeow/sendButtonsPRO";
        const baseUrl = config.baseUrl.replace(/\/$/, "");
        const msgPath = sendButtonsPath.startsWith("/") ? sendButtonsPath : "/" + sendButtonsPath;
        const fullUrl = baseUrl + msgPath;
        
        console.log(`POST ${fullUrl}`);

        // TRYING 'number' INSTEAD OF 'phone'
        const payload = {
            openTicket: 0,
            body: [
                {
                    number: targetNumber, // CHANGED THIS
                    title: "Teste Botão V2 (number field) 🚀",
                    body: "Se você estiver vendo este botão, responda OK! (Validando campo number)",
                    footer: "Rodapé Teste",
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

        console.log("Payload:", JSON.stringify(payload, null, 2));

        const response = await axios.post(fullUrl, payload, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${config.token}`
            }
        });

        console.log("✅ API Response Status:", response.status);
        console.log("Response Body:", JSON.stringify(response.data, null, 2));

    } catch (error: any) {
        console.error("❌ Request Failed!");
        if (error.response) {
            console.error(`Status: ${error.response.status}`);
            console.error("Data:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.error("Error:", error.message);
        }
    }
}

run();
