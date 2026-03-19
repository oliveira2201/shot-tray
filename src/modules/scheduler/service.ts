import { v4 as uuidv4 } from "uuid";
import { getRedis, isRedisReady } from "../../lib/redis.js";
import { TenantService } from "../../services/tenantService.js";
import { logger } from "../../utils/logger.js";
import { processEvent } from "../automation/service.js";

// Redis keys
const JOBS_ZSET = "shot:jobs";           // Sorted set: score=executeAt, member=jobId
const JOB_PREFIX = "shot:job:";          // Hash per job: shot:job:{id}
const LOG_LIST = "shot:logs";            // List: últimos N eventos
const STATS_HASH = "shot:stats";         // Hash: contadores globais

interface ScheduledJob {
  id: string;
  flowAlias: string;
  tenantId: string;
  executeAt: number;
  context: any;
  remainingSteps?: any[];
  cancelIfTags?: string[];
  createdAt: number;
  status: "pending" | "running" | "done" | "cancelled" | "error";
}

export interface EventLog {
  id: string;
  timestamp: number;
  type: "webhook_received" | "flow_started" | "flow_completed" | "flow_error" | "job_scheduled" | "job_executed" | "job_cancelled" | "job_error";
  tenantId: string;
  flowAlias?: string;
  phone?: string;
  detail?: string;
  jobId?: string;
}

const MAX_LOGS = 500;

export class SchedulerService {
  private static checkInterval: NodeJS.Timeout | null = null;

  static async init() {
    this.startWorker();
  }

  /** Registra um evento no log */
  static async log(entry: Omit<EventLog, "id" | "timestamp">) {
    try {
      const ready = await isRedisReady();
      if (!ready) return;

      const redis = getRedis();
      const log: EventLog = {
        ...entry,
        id: uuidv4(),
        timestamp: Date.now(),
      };
      await redis.lpush(LOG_LIST, JSON.stringify(log));
      await redis.ltrim(LOG_LIST, 0, MAX_LOGS - 1);

      // Incrementar contador
      await redis.hincrby(STATS_HASH, entry.type, 1);
      await redis.hincrby(STATS_HASH, `tenant:${entry.tenantId}:total`, 1);
    } catch (err: any) {
      logger.warn({ err: err.message }, "Falha ao registrar log no Redis");
    }
  }

  /** Agenda continuação de flow */
  static async scheduleContinuation(
    tenantId: string,
    flowAlias: string,
    delaySeconds: number,
    context: any,
    remainingSteps: any[],
    cancelIfTags: string[]
  ) {
    const job: ScheduledJob = {
      id: uuidv4(),
      tenantId,
      flowAlias,
      executeAt: Date.now() + delaySeconds * 1000,
      context,
      remainingSteps,
      cancelIfTags,
      createdAt: Date.now(),
      status: "pending",
    };

    try {
      const ready = await isRedisReady();
      if (!ready) {
        // Fallback: executar inline com delay (menos ideal mas não perde)
        logger.warn({ jobId: job.id }, "Redis indisponível — executando wait inline");
        const { delay } = await import("../../utils/delay.js");
        await delay(delaySeconds * 1000);
        await this._executeJob(job);
        return;
      }

      const redis = getRedis();
      await redis.set(`${JOB_PREFIX}${job.id}`, JSON.stringify(job));
      await redis.zadd(JOBS_ZSET, job.executeAt, job.id);

      logger.info(
        { jobId: job.id, flow: flowAlias, executeIn: `${delaySeconds}s`, cancelIfTags },
        "Job agendado"
      );

      await this.log({
        type: "job_scheduled",
        tenantId,
        flowAlias,
        phone: context?.number,
        detail: `Executa em ${delaySeconds}s. ${cancelIfTags.length > 0 ? `Cancela se: ${cancelIfTags.join(", ")}` : "Sem cancelamento"}`,
        jobId: job.id,
      });
    } catch (err: any) {
      logger.error({ err: err.message, jobId: job.id }, "Erro ao agendar job");
    }
  }

  /** Agenda flow completo (legado) */
  static async scheduleFlow(tenantId: string, flowAlias: string, delaySeconds: number, context: any) {
    await this.scheduleContinuation(tenantId, flowAlias, delaySeconds, context, [], []);
  }

  /** Retorna jobs pendentes */
  static async getPendingJobs(): Promise<ScheduledJob[]> {
    try {
      const ready = await isRedisReady();
      if (!ready) return [];

      const redis = getRedis();
      const jobIds = await redis.zrange(JOBS_ZSET, 0, -1);
      const jobs: ScheduledJob[] = [];

      for (const id of jobIds) {
        const raw = await redis.get(`${JOB_PREFIX}${id}`);
        if (raw) jobs.push(JSON.parse(raw));
      }

      return jobs;
    } catch {
      return [];
    }
  }

  /** Retorna logs recentes */
  static async getLogs(limit = 50): Promise<EventLog[]> {
    try {
      const ready = await isRedisReady();
      if (!ready) return [];

      const redis = getRedis();
      const raw = await redis.lrange(LOG_LIST, 0, limit - 1);
      return raw.map((item: string) => JSON.parse(item));
    } catch {
      return [];
    }
  }

  /** Retorna stats globais */
  static async getStats(): Promise<Record<string, string>> {
    try {
      const ready = await isRedisReady();
      if (!ready) return {};

      const redis = getRedis();
      return await redis.hgetall(STATS_HASH);
    } catch {
      return {};
    }
  }

  /** Cancela um job específico */
  static async cancelJob(jobId: string): Promise<boolean> {
    try {
      const ready = await isRedisReady();
      if (!ready) return false;

      const redis = getRedis();
      const raw = await redis.get(`${JOB_PREFIX}${jobId}`);
      if (!raw) return false;

      const job: ScheduledJob = JSON.parse(raw);
      job.status = "cancelled";
      await redis.set(`${JOB_PREFIX}${jobId}`, JSON.stringify(job));
      await redis.zrem(JOBS_ZSET, jobId);

      logger.info({ jobId }, "Job cancelado manualmente");
      return true;
    } catch {
      return false;
    }
  }

  // --- Worker ---

  private static startWorker() {
    logger.info(">>> [Scheduler] Worker Redis iniciado");
    // Verificar a cada 10 segundos
    this.checkInterval = setInterval(() => this._processQueue(), 10_000);
    // Processar pendências antigas imediatamente
    this._processQueue();
  }

  static stopWorker() {
    if (this.checkInterval) clearInterval(this.checkInterval);
  }

  private static async _processQueue() {
    try {
      const ready = await isRedisReady();
      if (!ready) return;

      const redis = getRedis();
      const now = Date.now();

      // Buscar jobs com executeAt <= now
      const jobIds = await redis.zrangebyscore(JOBS_ZSET, 0, now);
      if (jobIds.length === 0) return;

      for (const jobId of jobIds) {
        const raw = await redis.get(`${JOB_PREFIX}${jobId}`);
        if (!raw) {
          await redis.zrem(JOBS_ZSET, jobId);
          continue;
        }

        const job: ScheduledJob = JSON.parse(raw);
        if (job.status !== "pending") {
          await redis.zrem(JOBS_ZSET, jobId);
          continue;
        }

        // Marcar como running
        job.status = "running";
        await redis.set(`${JOB_PREFIX}${jobId}`, JSON.stringify(job));
        await redis.zrem(JOBS_ZSET, jobId);

        // Executar
        await this._executeJob(job);
      }
    } catch (err: any) {
      logger.error({ err: err.message }, "Erro no worker do Scheduler");
    }
  }

  private static async _executeJob(job: ScheduledJob) {
    try {
      logger.info({ jobId: job.id, flow: job.flowAlias, hasContinuation: !!job.remainingSteps?.length }, "Executando job");

      const tenantConfig = await TenantService.getTenantConfig(job.tenantId);
      if (!tenantConfig) {
        logger.error({ tenant: job.tenantId }, "Tenant não encontrado para job");
        await this._markJob(job, "error", "Tenant não encontrado");
        return;
      }

      // Checar cancelIfTags
      if (job.cancelIfTags && job.cancelIfTags.length > 0 && job.context?.number) {
        const provider = tenantConfig.provider;
        if (provider.getContactTags) {
          const currentTags = await provider.getContactTags(job.context.number);
          const normalizedCurrent = currentTags.map(t => t.toLowerCase());
          const shouldCancel = job.cancelIfTags.some(t => normalizedCurrent.includes(t.toLowerCase()));

          if (shouldCancel) {
            logger.info({ jobId: job.id, cancelIfTags: job.cancelIfTags }, "Job cancelado — tag encontrada");
            await this._markJob(job, "cancelled", `Tag encontrada: ${job.cancelIfTags.join(", ")}`);
            await this.log({
              type: "job_cancelled",
              tenantId: job.tenantId,
              flowAlias: job.flowAlias,
              phone: job.context?.number,
              detail: `Cancelado por tag`,
              jobId: job.id,
            });
            return;
          }
        }
      }

      // Executar
      if (job.remainingSteps && job.remainingSteps.length > 0) {
        const { runUseCase } = await import("../automation/engine/case-runner.js");
        await runUseCase({
          useCase: {
            id: job.flowAlias + "_cont",
            title: job.flowAlias,
            aliases: [],
            description: "Continuação agendada",
            steps: job.remainingSteps,
          },
          context: job.context,
          provider: tenantConfig.provider,
          templates: tenantConfig.templates,
        });
      } else {
        await processEvent({
          flowAlias: job.flowAlias,
          tenantConfig,
          context: job.context,
        });
      }

      await this._markJob(job, "done");
      await this.log({
        type: "job_executed",
        tenantId: job.tenantId,
        flowAlias: job.flowAlias,
        phone: job.context?.number,
        detail: `Steps: ${job.remainingSteps?.length || 0}`,
        jobId: job.id,
      });

    } catch (err: any) {
      logger.error({ jobId: job.id, err: err.message }, "Erro ao executar job");
      await this._markJob(job, "error", err.message);
      await this.log({
        type: "job_error",
        tenantId: job.tenantId,
        flowAlias: job.flowAlias,
        phone: job.context?.number,
        detail: err.message,
        jobId: job.id,
      });
    }
  }

  private static async _markJob(job: ScheduledJob, status: ScheduledJob["status"], detail?: string) {
    try {
      const ready = await isRedisReady();
      if (!ready) return;

      const redis = getRedis();
      job.status = status;
      (job as any).completedAt = Date.now();
      if (detail) (job as any).detail = detail;
      await redis.set(`${JOB_PREFIX}${job.id}`, JSON.stringify(job));
      // Expirar jobs finalizados após 24h
      if (status !== "pending" && status !== "running") {
        await redis.expire(`${JOB_PREFIX}${job.id}`, 86400);
      }
    } catch {}
  }
}
