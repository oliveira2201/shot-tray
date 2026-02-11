
import fs from 'fs';
import path from 'path';
import tenantsConfig from '../src/config/tenants.json';
import { ShotzapProvider } from '../src/modules/automation/channels/shotzap/provider';

// Caminhos onde procurar fluxos
const FLOW_DIRS = [
    path.join(process.cwd(), 'src/tenants/ebenezer/flows'),
    path.join(process.cwd(), 'flows') // Inclui a pasta raiz também pois o usuário mencionou "tem varios fluxos lá"
];

// Helper para ler arquivos recursivamente (se precisar) ou flat
function getJsonFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const files = fs.readdirSync(dir);
    return files
        .filter(f => f.endsWith('.json'))
        .map(f => path.join(dir, f));
}

// Extrai tags de um objeto de fluxo
function extractTags(flowObj: any): Set<string> {
    const tags = new Set<string>();

    // 1. Estrutura Padrão (steps)
    if (flowObj.steps && Array.isArray(flowObj.steps)) {
        // Função recursiva para varrer steps
        const visit = (step: any) => {
            if (step.tag && typeof step.tag === 'string') {
                tags.add(step.tag);
            }
            if (step.tags && Array.isArray(step.tags)) {
                step.tags.forEach((t: any) => {
                    if (typeof t === 'string') tags.add(t);
                });
            }
        };
        flowObj.steps.forEach(visit);
    }
    
    // 2. Estrutura Legada/Visual (nodes)
    if (flowObj.nodes && Array.isArray(flowObj.nodes)) {
        flowObj.nodes.forEach((node: any) => {
            // Verifica se tem tag no data.secName
            if (node.data && node.data.secName && typeof node.data.secName === 'string') {
                // Filtra apenas se for um nó relevante ou pega tudo que tiver secName?
                // Parece que secName é a tag em si nesses nós
                if (node.data.secName.trim() !== "") {
                    tags.add(node.data.secName);
                }
            }
        });
    }

    return tags;
}

async function main() {
    console.log(">>> Iniciando Sincronização de Tags...");

    // 1. Configurar Provider
    // Pega configuração do tenant Ebenezer do array
    const tenantId = 'ebenezer';
    // O json importado é um array
    const tenant = (tenantsConfig as any[]).find(t => t.id === tenantId);

    if (!tenant) {
        throw new Error(`Tenant ${tenantId} não encontrado no arquivo de configuração.`);
    }

    // A config está direta no objeto do tenant, baseada no user context do provider anterior
    // O ShotzapProvider espera { baseUrl, token, tagsToken, paths, ... }
    const config = tenant.config;
    
    // O construtor do provider pede o objeto de config específico do canal
    const provider = new ShotzapProvider(config);

    // 2. Coletar Tags
    const allTags = new Set<string>();

    for (const dir of FLOW_DIRS) {
        console.log(`Lendo diretório: ${dir}`);
        const files = getJsonFiles(dir);
        console.log(`Encontrados ${files.length} arquivos JSON.`);

        for (const file of files) {
            try {
                const content = fs.readFileSync(file, 'utf-8');
                const json = JSON.parse(content);
                const flowTags = extractTags(json);
                console.log(`  - ${path.basename(file)}: ${flowTags.size} tags encontradas.`);
                flowTags.forEach(t => allTags.add(t));
            } catch (err: any) {
                console.error(`Erro ao ler arquivo ${file}:`, err.message);
            }
        }
    }

    const uniqueTags = Array.from(allTags);
    console.log(`\nTotal de tags únicas encontradas em todos os fluxos: ${uniqueTags.length}`);
    console.log('Tags:', uniqueTags);

    if (uniqueTags.length === 0) {
        console.log('Nenhuma tag encontrada para sincronizar.');
        return;
    }

    // 3. Sincronizar
    console.log("\n>>> Enviando para ShotzapProvider...");
    try {
        await provider.syncTags(uniqueTags);
        console.log("\n>>> SUCESSO! Todas as tags foram verificadas/criadas.");
    } catch (err: any) {
        console.error(">>> ERRO FATAL na sincronização:", err);
    }
}

main();
