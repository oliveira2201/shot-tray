import fs from "fs-extra";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { TenantService } from "../../services/tenantService.js";
import { logger } from "../../utils/logger.js";
import { processEvent } from "../automation/service.js";

const QUEUE_DIR = path.resolve(process.cwd(), "data", "queue");

interface ScheduledJob {
  id: string;
  flowAlias: string;
  tenantId: string;
  executeAt: number; // Timestamp
  context: any;
  // Para cancelableWait: steps restantes do flow a executar
  remainingSteps?: any[];
  cancelIfTags?: string[];
}

export class SchedulerService {
  private static isRunning = false;
  private static checkInterval: NodeJS.Timeout | null = null;

  static async init() {
    await fs.ensureDir(QUEUE_DIR);
    this.startWorker();
  }

  /**
   * Agenda a continuação de um flow (steps restantes) após um delay.
   * Se cancelIfTags estiver definido, checa as tags do contato antes de executar.
   */
  static async scheduleContinuation(
    tenantId: string,
    flowAlias: string,
    delaySeconds: number,
    context: any,
    remainingSteps: any[],
    cancelIfTags: string[]
  ) {
    const executeAt = Date.now() + (delaySeconds * 1000);
    const job: ScheduledJob = {
      id: uuidv4(),
      tenantId,
      flowAlias,
      executeAt,
      context,
      remainingSteps,
      cancelIfTags
    };

    const filePath = path.join(QUEUE_DIR, `${executeAt}_${job.id}.json`);
    await fs.writeJson(filePath, job);

    logger.info(
      { flow: flowAlias, executeIn: `${delaySeconds}s`, jobId: job.id, cancelIfTags },
      "Continuação agendada (cancelableWait)"
    );
  }

  static async scheduleFlow(tenantId: string, flowAlias: string, delaySeconds: number, context: any) {
    const executeAt = Date.now() + (delaySeconds * 1000);
    const job: ScheduledJob = {
      id: uuidv4(),
      tenantId,
      flowAlias,
      executeAt,
      context
    };

    const filePath = path.join(QUEUE_DIR, `${executeAt}_${job.id}.json`);
    await fs.writeJson(filePath, job);
    
    logger.info({ flow: flowAlias, executeIn: `${delaySeconds}s`, jobId: job.id }, "Fluxo agendado com sucesso");
  }

  private static startWorker() {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info(">>> [Scheduler] Worker iniciado. Monitorando fila de arquivos JSON.");

    // Verifica a cada 60 segundos (pode ser ajustado)
    this.checkInterval = setInterval(() => this.processQueue(), 60000);
    
    // Executa imediatamente ao iniciar para pegar pendências antigas
    this.processQueue(); 
  }

  static stopWorker() {
    if (this.checkInterval) clearInterval(this.checkInterval);
    this.isRunning = false;
  }

  private static async processQueue() {
    try {
      const files = await fs.readdir(QUEUE_DIR);
      const now = Date.now();

      for (const file of files) {
        if (!file.endsWith(".json")) continue;

        // Padrão do nome: TIMESTAP_ID.json
        // Permite checagem rápida sem ler o arquivo
        const [timestampStr] = file.split("_");
        const executeAt = parseInt(timestampStr);

        if (isNaN(executeAt)) continue;

        if (now >= executeAt) {
          await this.executeJob(path.join(QUEUE_DIR, file));
        }
      }
    } catch (error) {
      logger.error({ error }, "Erro ao processar fila do Scheduler");
    }
  }

  private static async executeJob(filePath: string) {
    let job: ScheduledJob | null = null;
    try {
      job = await fs.readJson(filePath);
      if (!job) return;

      logger.info({ jobId: job.id, flow: job.flowAlias, hasContinuation: !!job.remainingSteps }, ">>> [Scheduler] Executando Job agendado");

      // 1. Carregar Tenant Config
      const tenantConfig = await TenantService.getTenantConfig(job.tenantId);
      if (!tenantConfig) {
          logger.error({ tenant: job.tenantId }, "Tenant não encontrado para Job agendado. Job será descartado.");
          await fs.unlink(filePath);
          return;
      }

      // 2. Se tem cancelIfTags, verificar se deve cancelar
      if (job.cancelIfTags && job.cancelIfTags.length > 0 && job.context?.number) {
        const provider = tenantConfig.provider;
        if (provider.getContactTags) {
          const currentTags = await provider.getContactTags(job.context.number);
          const normalizedCurrent = currentTags.map(t => t.toLowerCase());
          const shouldCancel = job.cancelIfTags.some(t => normalizedCurrent.includes(t.toLowerCase()));

          if (shouldCancel) {
            logger.info(
              { jobId: job.id, cancelIfTags: job.cancelIfTags, currentTags },
              ">>> [Scheduler] Job cancelado — contato já tem tag de cancelamento"
            );
            await fs.unlink(filePath);
            return;
          }
        }
      }

      // 3. Se é continuação (remainingSteps), executar steps restantes direto
      if (job.remainingSteps && job.remainingSteps.length > 0) {
        const { runUseCase } = await import("../automation/engine/case-runner.js");
        const continuationUseCase = {
          id: job.flowAlias + "_continuation",
          title: job.flowAlias,
          aliases: [],
          description: "Continuação de cancelableWait",
          steps: job.remainingSteps
        };
        await runUseCase({
          useCase: continuationUseCase,
          context: job.context,
          provider: tenantConfig.provider,
          templates: tenantConfig.templates
        });
      } else {
        // 4. Execução normal (scheduleFlow legado)
        await processEvent({
          flowAlias: job.flowAlias,
          tenantConfig,
          context: job.context
        });
      }

      // 3. Remover da fila se sucesso
      await fs.unlink(filePath);
      logger.info({ jobId: job.id }, "Job concluído e removido da fila");

    } catch (error: any) {
      logger.error({ jobId: job?.id, error: error.message }, "Falha na execução do Job");
      
      // Opcional: Implementar Retry ou Mover para DeadLetterQueue (DLQ)
      // Por enquanto, mantemos o arquivo para tentar novamente no proximo ciclo?
      // OU renomeamos para .error para não travar?
      // Vamos renomear para .error para análise manual e não travar a fila
      if (filePath && fs.existsSync(filePath)) {
          const errorPath = filePath + ".error";
          await fs.rename(filePath, errorPath);
          logger.warn(`Job movido para quarentena: ${errorPath}`);
      }
    }
  }
}
