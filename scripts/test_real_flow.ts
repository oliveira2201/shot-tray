import path from "path";
import { fileURLToPath } from 'url';
import { processEvent } from "../src/modules/automation/service.js";
import { TenantService } from "../src/services/tenantService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runRealFlow() {
  console.log("=== INICIANDO TESTE DE FLUXO REAL ===");
  try {
    // 1. Carregar Configuração Real do Tenant
    // Precisamos garantir que ele leia do arquivo correto
    const tenantId = "ebenezer";
    console.log(`Carregando configurações para: ${tenantId}...`);
    
    // Hack para ler json com assert type em modules se necessário, ou confiar no service
    // O TenantService usa import estático do JSON, deve funcionar se o ts-node resolver.
    const tenantConfig = await TenantService.getTenantConfig(tenantId);
    
    if (!tenantConfig) {
      throw new Error("Tenant não encontrado!");
    }

    console.log("Tenant carregado. Provider:", tenantConfig.provider.constructor.name);

    // 2. Simular Payload do Webhook (Cenário: Carrinho Abandonado)
    const rawWebhookPayload = {
      type: "carrinho_abandonado",
      customer: { 
        name: "Teste Real Fluxo", 
        phone: "5586995336923" 
      },
      itemsSummary: "Livro Teste de Fogo" // O Adapter mapeia isso para extra3
    };

    console.log("Normalizando evento...");
    const { inputAdapter } = tenantConfig;
    const normalizedEvent = inputAdapter.normalizeEvent(rawWebhookPayload);

    if (!normalizedEvent) {
      throw new Error("Falha ao normalizar evento. Verifique status/type.");
    }
    
    console.log("Evento Normalizado:", JSON.stringify(normalizedEvent, null, 2));

    // 3. Executar o Processamento (Isso chamará a API Real)
    console.log(">>> Executando Engine de Automação (Real)...");
    
    await processEvent({
      flowAlias: normalizedEvent.flowAlias,
      context: normalizedEvent,
      tenantConfig
    });

    console.log("=== SUCESSO! Verifique seu WhatsApp (5586995336923) ===");

  } catch (error: any) {
    console.error("=== ERRO NO FLUXO REAL ===");
    console.error(error);
    if (error.response) {
       console.error("Detalhes da API:", error.response.data);
    }
  }
}

runRealFlow();
