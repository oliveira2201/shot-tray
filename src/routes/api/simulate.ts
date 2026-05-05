import { Router } from "express";
import fs from "fs/promises";
import path from "path";
import axios from "axios";
import { logger } from "../../utils/logger.js";
import { TenantService } from "../../services/tenantService.js";
// @ts-ignore
import tenantsData from "../../config/tenants.json" assert { type: "json" };

export const simulateApiRouter = Router();

interface SimulationLog {
  step: number;
  type: string;
  label: string;
  action: string;
  detail?: string;
  timestamp: number; // tempo simulado em segundos desde o início
  cancelled?: boolean;
  realResult?: string; // resultado do envio real
}

// POST /api/admin/simulate/:tenantId/:flowId — simula execução do flow
simulateApiRouter.post("/api/admin/simulate/:tenantId/:flowId", async (req, res) => {
  const { tenantId, flowId } = req.params;
  const { context = {}, tagsAtTime = {}, sendReal = false } = req.body;

  // Se sendReal, carrega o provider real do tenant
  let provider: any = null;
  let templates: Record<string, any> = {};
  let tenantRaw: any = null;
  if (sendReal) {
    try {
      const tenantConfig = await TenantService.getTenantConfig(tenantId);
      if (tenantConfig) {
        provider = tenantConfig.provider;
        templates = tenantConfig.templates || {};
      }
      tenantRaw = (tenantsData as any[]).find((t: any) => t.id === tenantId);
    } catch (e: any) {
      logger.warn({ err: e }, "Falha ao carregar provider para envio real");
    }
  }

  // Helpers diretos pra API (bypass provider pra tags)
  const apiCall = async (method: string, urlPath: string, data?: any) => {
    if (!tenantRaw) return null;
    const baseUrl = tenantRaw.config.baseUrl;
    const token = tenantRaw.config.token;
    const res = await axios({ method, url: `${baseUrl}${urlPath}`, data, headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Authorization": `Bearer ${token}`,
    }});
    return res.data;
  };

  const addTagDirect = async (ticketId: number, tagName: string): Promise<string> => {
    try {
      // Buscar tagId da lista
      const allTags = await apiCall("get", "/api/tags");
      const tagList = Array.isArray(allTags) ? allTags : (allTags?.tags || []);
      const tag = tagList.find((t: any) => t.name === tagName);
      if (!tag) return `Tag "${tagName}" não encontrada`;

      await apiCall("post", "/api/tags/add", { ticketId, tags: [{ id: tag.id }] });
      return `TAG APLICADA (${tag.id})`;
    } catch (e: any) {
      return `ERRO TAG: ${e.message}`;
    }
  };
  // tagsAtTime: { [secondsFromStart]: string[] } — tags que o contato terá naquele momento
  // Permite simular: "aos 7200s o contato já tem [EBE] Pedido Pago"

  const filePath = path.join(
    process.cwd(), "src", "tenants", tenantId, "flows", `${flowId}.json`
  );

  try {
    const content = await fs.readFile(filePath, "utf-8");
    const flow = JSON.parse(content);
    const logs: SimulationLog[] = [];
    let currentTime = 0; // segundos simulados
    let currentTags: string[] = context.tags || [];
    let ticketId: number | null = null; // capturado do primeiro envio real
    const pendingTagIds: { tag: string; stepIdx: number }[] = []; // tags pendentes até ter ticketId

    for (let i = 0; i < flow.steps.length; i++) {
      const step = flow.steps[i];

      // Atualizar tags baseado no tempo simulado (tagsAtTime)
      for (const [timeStr, tags] of Object.entries(tagsAtTime)) {
        const time = parseInt(timeStr);
        if (time <= currentTime && Array.isArray(tags)) {
          currentTags = [...new Set([...currentTags, ...(tags as string[])])];
        }
      }

      switch (step.type) {
        case "addTag": {
          currentTags = [...new Set([...currentTags, step.tag])];
          let tagResult: string | undefined;

          if (sendReal && tenantRaw && context.number) {
            if (ticketId) {
              tagResult = await addTagDirect(ticketId, step.tag);
            } else {
              pendingTagIds.push({ tag: step.tag, stepIdx: i });
              tagResult = `ENFILEIRADA (aguardando envio)`;
            }
          }

          logs.push({
            step: i, type: step.type, label: step.label,
            action: `Tag adicionada: ${step.tag}`,
            detail: tagResult,
            timestamp: currentTime,
          });
          break;
        }

        case "removeTag": {
          currentTags = currentTags.filter(t => t !== step.tag);
          let tagResult: string | undefined;

          if (sendReal && tenantRaw && ticketId) {
            try {
              // Enviar tags:[] limpa todas do ticket
              await apiCall("post", "/api/tags/add", { ticketId, tags: [] });
              tagResult = `TAGS REMOVIDAS`;
            } catch (e: any) {
              tagResult = `ERRO: ${e.message}`;
            }
          }

          logs.push({
            step: i, type: step.type, label: step.label,
            action: `Tag removida: ${step.tag}`,
            detail: tagResult,
            timestamp: currentTime,
          });
          break;
        }

        case "stopIfHasAnyTag": {
          const normalized = currentTags.map(t => t.toLowerCase());
          const match = step.tags?.find((t: string) => normalized.includes(t.toLowerCase()));
          if (match) {
            logs.push({
              step: i, type: step.type, label: step.label,
              action: `FLOW PARADO — contato tem tag: ${match}`,
              timestamp: currentTime, cancelled: true,
            });
            return res.json({ flowId, logs, currentTags, totalTime: currentTime, cancelled: true });
          }
          logs.push({
            step: i, type: step.type, label: step.label,
            action: `Verificação OK — nenhuma tag bloqueante`,
            timestamp: currentTime,
          });
          break;
        }

        case "wait":
          currentTime += step.seconds || 0;
          logs.push({
            step: i, type: step.type, label: step.label,
            action: `Aguardou ${step.seconds}s`,
            detail: `Tempo total: ${formatTime(currentTime)}`,
            timestamp: currentTime,
          });
          break;

        case "cancelableWait": {
          const waitSeconds = step.seconds || 0;
          currentTime += waitSeconds;

          // Atualizar tags pro tempo após a espera
          for (const [timeStr, tags] of Object.entries(tagsAtTime)) {
            const time = parseInt(timeStr);
            if (time <= currentTime && Array.isArray(tags)) {
              currentTags = [...new Set([...currentTags, ...(tags as string[])])];
            }
          }

          // Verificar cancelamento
          const cancelTags = step.cancelIfTags || [];
          const normalizedCurrent = currentTags.map((t: string) => t.toLowerCase());
          const cancelMatch = cancelTags.find((t: string) => normalizedCurrent.includes(t.toLowerCase()));

          if (cancelMatch) {
            logs.push({
              step: i, type: step.type, label: step.label,
              action: `CANCELADO após ${formatTime(waitSeconds)} — contato tem tag: ${cancelMatch}`,
              detail: `Tempo total: ${formatTime(currentTime)}`,
              timestamp: currentTime, cancelled: true,
            });
            return res.json({ flowId, logs, currentTags, totalTime: currentTime, cancelled: true });
          }

          logs.push({
            step: i, type: step.type, label: step.label,
            action: `Aguardou ${formatTime(waitSeconds)} — sem cancelamento`,
            detail: `Tempo total: ${formatTime(currentTime)}`,
            timestamp: currentTime,
          });
          break;
        }

        case "sendText": {
          const textKey = step.textKey || step.text || '?';
          let realResult: string | undefined;

          if (sendReal && tenantRaw && context.number) {
            try {
              const template = templates[textKey];
              let msgBody = '';
              if (typeof template === 'function') {
                msgBody = template(context);
              } else if (typeof template === 'string') {
                msgBody = template.replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => context[key] || key);
              } else if (step.text && step.text !== step.textKey) {
                msgBody = step.text;
              } else {
                msgBody = `[Simulação] ${textKey}`;
              }

              // Chamar API diretamente (bypass provider)
              const sendRes = await apiCall("post", "/api/messages/send", {
                number: context.number,
                body: msgBody,
                openTicket: "0",
                queueId: "0",
              });
              realResult = `ENVIADO: "${msgBody.substring(0, 80)}${msgBody.length > 80 ? '...' : ''}"`;

              // Capturar ticketId
              if (!ticketId) {
                ticketId = sendRes?.retorno?.ticketId || sendRes?.ticket?.id || null;
                // Flush tags pendentes
                if (ticketId && pendingTagIds.length > 0) {
                  for (const pt of pendingTagIds) {
                    const tagRes = await addTagDirect(ticketId, pt.tag);
                    const pendingLog = logs.find(l => l.step === pt.stepIdx);
                    if (pendingLog) pendingLog.detail = tagRes;
                  }
                  pendingTagIds.length = 0;
                }
              }
            } catch (e: any) {
              realResult = `ERRO: ${e.message}`;
            }
          }

          logs.push({
            step: i, type: step.type, label: step.label,
            action: sendReal ? `Texto enviado: ${textKey}` : `Enviaria texto: ${textKey}`,
            detail: realResult,
            timestamp: currentTime,
          });
          break;
        }

        case "sendButtons": {
          const templateKey = step.templateKey || step.template || '?';
          let realResult: string | undefined;

          if (sendReal && tenantRaw && context.number) {
            try {
              const template = templates[templateKey];
              const replacePlaceholders = (s: string) =>
                s?.replace(/\{\{(\w+)\}\}/g, (_: string, key: string) => context[key] || key) || '';

              if (template && typeof template === 'object' && !Array.isArray(template)) {
                // Deep clone e substituir placeholders em buttons
                const processedButtons = JSON.parse(JSON.stringify(template.buttons || []));
                for (const btn of processedButtons) {
                  for (const key of Object.keys(btn)) {
                    if (typeof btn[key] === 'string') {
                      btn[key] = replacePlaceholders(btn[key]);
                    }
                  }
                }

                // Chamar API diretamente (bypass provider)
                const sendRes = await apiCall("post", "/api/messages/whatsmeow/sendButtonsPRO", {
                  openTicket: 0,
                  body: [{
                    phone: context.number,
                    title: replacePlaceholders(template.title || ''),
                    body: replacePlaceholders(template.body || ''),
                    footer: replacePlaceholders(template.footer || ''),
                    buttons: processedButtons,
                  }]
                });
                realResult = `ENVIADO: "${replacePlaceholders(template.title || '').substring(0, 50)}"`;

                if (!ticketId) {
                  ticketId = sendRes?.retorno?.ticketId || sendRes?.ticket?.id || null;
                }
              } else {
                realResult = `Template "${templateKey}" não encontrado`;
              }
            } catch (e: any) {
              realResult = `ERRO: ${e.message}`;
            }
          }

          logs.push({
            step: i, type: step.type, label: step.label,
            action: sendReal ? `Botões enviados: ${templateKey}` : `Enviaria botões: ${templateKey}`,
            detail: realResult,
            timestamp: currentTime,
          });
          break;
        }

        case "conditionalChoice":
          logs.push({
            step: i, type: step.type, label: step.label,
            action: `Aguardaria escolha (${step.conditions?.length || 0} condições)`,
            timestamp: currentTime,
          });
          break;

        case "scheduleFlow":
          logs.push({
            step: i, type: step.type, label: step.label,
            action: `Agendaria flow: ${step.targetFlow} em +${step.delaySeconds}s`,
            timestamp: currentTime,
          });
          break;

        default:
          logs.push({
            step: i, type: step.type, label: step.label || "?",
            action: `Step desconhecido: ${step.type}`,
            timestamp: currentTime,
          });
      }
    }

    res.json({ flowId, logs, currentTags, totalTime: currentTime, cancelled: false });
  } catch (err) {
    logger.error({ err }, "Erro na simulação");
    res.status(500).json({ error: "Erro na simulação" });
  }
});

function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h${m}min` : `${h}h`;
}
