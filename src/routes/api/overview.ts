import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import { logger } from "../../utils/logger.js";

export const overviewApiRouter = Router();

const configPath = () => path.join(process.cwd(), "src", "config", "tenants.json");

// Retorna as regras de roteamento e payload esperado por adapter
function getAdapterRouting(adapterName: string, flows: any[]) {
  if (adapterName === "nuvemshop") {
    const rules = [
      { condition: 'open,pending,unpacked', type: "exact", flowAlias: "[EC] Pedido Recebido", description: "Pedido criado aguardando pagamento" },
      { condition: 'open,paid,unpacked', type: "exact", flowAlias: "[EC] Pedido Pago", description: "Pagamento confirmado" },
      { condition: 'shipped', type: "contains", flowAlias: "[EC] Pedido Enviado", description: "Pedido despachado" },
      { condition: 'delivered', type: "contains", flowAlias: "[EC] Pedido Entregue", description: "Pedido entregue" },
      { condition: 'cancelled / refunded', type: "contains", flowAlias: "[EC] Pedido Cancelado1", description: "Pedido cancelado ou reembolsado" },
      { condition: 'abandonou.carrinho', type: "contains", flowAlias: "[EC] Carrinho Abandonado1", description: "Carrinho abandonado" },
    ];

    // Verificar se cada flowAlias tem um flow correspondente
    const rulesWithFlow = rules.map(r => {
      const flow = flows.find((f: any) =>
        f.aliases?.some((a: string) => a.replace(/^_/, '') === r.flowAlias)
      );
      return {
        ...r,
        flowId: flow?.id || null,
        flowTitle: flow?.title || null,
        active: !!flow && !flow.aliases?.every((a: string) => a.startsWith('_')),
      };
    });

    return {
      name: "Nuvemshop (via middleware)",
      webhookMethod: "POST",
      contentType: "application/json ou application/x-www-form-urlencoded",
      payloadExample: {
        taginternals: "open,pending,unpacked",
        fname: "Nome do Cliente",
        phone: "5511999999999",
        email: "cliente@email.com",
        tracknumb: "https://loja.com/rastreio/123",
      },
      fields: [
        { key: "taginternals", description: "Status do pedido (determina o roteamento)", required: true },
        { key: "fname / FNAME", description: "Nome do cliente", required: true },
        { key: "phone / PHONE", description: "Telefone com DDI+DDD", required: true },
        { key: "email / EMAIL", description: "Email do cliente", required: false },
        { key: "tracknumb / TRACKNUMB", description: "URL de rastreio", required: false },
      ],
      rules: rulesWithFlow,
    };
  }

  // Adapter genérico (default/tray)
  return {
    name: "Genérico",
    webhookMethod: "POST",
    contentType: "application/json",
    payloadExample: {
      status: "pedido_recebido",
      customer: { name: "Nome", phone: "5511999999999" },
      trackingUrl: "https://...",
    },
    fields: [
      { key: "status / type / event", description: "Tipo do evento", required: true },
      { key: "customer.name", description: "Nome do cliente", required: true },
      { key: "customer.phone", description: "Telefone", required: true },
      { key: "trackingUrl", description: "URL de rastreio", required: false },
    ],
    rules: [
      { condition: 'status contém "pedido_recebido"', flowAlias: "[EBE] Pedido Recebido", active: true },
      { condition: 'status contém "pedido_pago"', flowAlias: "[EBE] Pedido Pago", active: true },
      { condition: 'status contém "pedido_enviado"', flowAlias: "[EBE] Pedido Enviado", active: true },
      { condition: 'status contém "pedido_entregue"', flowAlias: "[EBE] Pedido Entregue", active: true },
      { condition: 'status contém "pedido_cancelado"', flowAlias: "[EBE] Pedido Cancelado1", active: true },
      { condition: 'status contém "carrinho_abandonado"', flowAlias: "[EBE] Carrinho Abandonado1", active: true },
    ],
  };
}

// GET /api/admin/overview/:tenantId
overviewApiRouter.get("/api/admin/overview/:tenantId", async (req, res) => {
  const { tenantId } = req.params;

  try {
    const raw = await fs.readFile(configPath(), "utf-8");
    const tenantsData = JSON.parse(raw);
    const tenant = tenantsData.find((t: any) => t.id === tenantId);
    if (!tenant) return res.status(404).json({ error: "Tenant não encontrado" });

    // 1. Eventos padrão de e-commerce
    const EVENTS = [
      "pedido_recebido",
      "pedido_pago",
      "pedido_enviado",
      "pedido_entregue",
      "pedido_cancelado",
      "carrinho_abandonado",
    ];

    // Mapeamento evento → palavras-chave pra encontrar o flow pelos aliases
    const EVENT_KEYWORDS: Record<string, string[]> = {
      pedido_recebido: ["pedido recebido"],
      pedido_pago: ["pedido pago"],
      pedido_enviado: ["pedido enviado"],
      pedido_entregue: ["pedido entregue"],
      pedido_cancelado: ["pedido cancelado"],
      carrinho_abandonado: ["carrinho abandonado"],
    };

    // 2. Ler flows
    const flowsDir = path.join(process.cwd(), "src", "tenants", tenantId, "flows");
    const flowFiles = await fs.readdir(flowsDir).catch(() => [] as string[]);

    const flows: Record<string, any> = {};
    for (const file of flowFiles) {
      if (!file.endsWith(".json")) continue;
      const content = await fs.readFile(path.join(flowsDir, file), "utf-8");
      const flow = JSON.parse(content);
      flows[flow.id] = {
        id: flow.id,
        title: flow.title,
        aliases: flow.aliases || [],
        stepsCount: flow.steps?.length || 0,
        stepTypes: flow.steps?.map((s: any) => s.type) || [],
      };
    }

    // 3. Pipeline: evento → busca flow pelo id ou aliases
    const pipeline = EVENTS.map((event) => {
      const keywords = EVENT_KEYWORDS[event] || [];
      // Primeiro tenta match pelo ID do flow (ex: pedidoRecebido → pedido_recebido)
      const eventCamel = event.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      let matchedFlow = flows[eventCamel] || null;

      // Se não achou pelo ID, busca pelos aliases
      if (!matchedFlow) {
        matchedFlow = Object.values(flows).find((f: any) =>
          f.aliases.some((a: string) => {
            const aLower = a.toLowerCase().replace(/^_/, '');
            return keywords.some(kw => aLower.includes(kw));
          })
        ) || null;
      }

      const alias = matchedFlow?.aliases?.[0] || '';
      return { event, alias, flow: matchedFlow };
    });

    // 4. Regras de roteamento do adapter
    const adapterRouting = getAdapterRouting(tenant.inputAdapter, Object.values(flows));

    res.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        adapter: tenant.inputAdapter,
        provider: tenant.outputProvider,
        webhookUrl: `/webhooks/${tenant.id}`,
        baseUrl: tenant.config?.baseUrl,
        token: tenant.config?.token ? "***" + tenant.config.token.slice(-4) : null,
      },
      pipeline,
      flows: Object.values(flows),
      unmappedFlows: Object.values(flows).filter(
        (f: any) => !pipeline.some((p) => p.flow?.id === f.id)
      ),
      adapterRouting,
    });
  } catch (err) {
    logger.error({ err }, "Erro ao gerar overview");
    res.status(500).json({ error: "Erro ao gerar overview" });
  }
});
