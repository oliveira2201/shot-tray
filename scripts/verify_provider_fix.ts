import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { ShotzapProvider } from "../src/modules/automation/channels/shotzap/provider.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
    try {
        // 1. Load Config directly to mimic TenantService
        const configPath = path.resolve(__dirname, "../src/config/tenants.json");
        const rawConfig = fs.readFileSync(configPath, 'utf-8');
        const tenants = JSON.parse(rawConfig);
        const tenant = tenants.find((t:any) => t.id === 'ebenezer');
        
        if (!tenant) throw new Error("Tenant not found");

        console.log("=== VERIFICAÇÃO DE FIX DO PROVIDER ===");
        
        // 2. Instantiate Provider using the source code class
        const provider = new ShotzapProvider({
            baseUrl: tenant.config.baseUrl,
            token: tenant.config.token,
            paths: tenant.config.paths
        });

        // 3. Simulate exact payload from "Pedido Recebido"
        const targetNumber = "5586995336923";
        const payloadFromTemplate = {
            openTicket: 0,
            body: [
              {
                phone: targetNumber,
                title: "👋 A Paz Usuario Teste",
                body: "Teste de Fix do Provider - Esta mensagem deve chegar formatada como texto.",
                footer: "Selecione uma opção",
                buttons: [
                  { type: "quickreply", text: "Rastrear Pedido", value: "Rastrear Pedido" },
                  { type: "quickreply", text: "Me Descadastre", value: "Me Descadastre" }
                ]
              }
            ]
        };

        console.log("Chamando provider.sendButtons()...");
        
        // This should trigger the console logs added to provider.ts
        const result = await provider.sendButtons(payloadFromTemplate);

        console.log("=== RESULTADO ===");
        console.log(JSON.stringify(result, null, 2));

    } catch (e: any) {
        console.error("ERRO:", e.message);
        if (e.response) console.error("Dados da Resposta de Erro:", e.response.data);
    }
}

run();
