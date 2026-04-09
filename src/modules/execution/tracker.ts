import { v4 as uuidv4 } from "uuid";
import { getPrisma } from "../../lib/prisma.js";
import { logger } from "../../utils/logger.js";

export type StepStatus = "ok" | "error" | "skipped" | "deferred";

export interface StepLog {
  index: number;
  type: string;
  label: string;
  status: StepStatus;
  durationMs: number;
  input?: any;
  output?: any;
  error?: string;
}

export type ExecutionStatus = "running" | "completed" | "failed" | "deferred" | "cancelled";

export interface ExecutionData {
  id: string;
  tenantId: string;
  flowId: string;
  flowAlias: string;
  phone?: string | null;
  customerName?: string | null;
  status: string;
  trigger: string;
  steps: StepLog[];
  error?: string | null;
  startedAt: Date;
  completedAt?: Date | null;
  durationMs?: number | null;
  webhookPayload?: any;
  webhookReceivedAt?: Date | null;
}

export class ExecutionTracker {
  private id: string;
  private tenantId: string;
  private flowId: string;
  private flowAlias: string;
  private phone?: string;
  private customerName?: string;
  private trigger: string;
  private steps: StepLog[] = [];
  private startedAt: number;
  private webhookPayload?: any;
  private webhookReceivedAt?: number;

  constructor(opts: {
    tenantId: string;
    flowId: string;
    flowAlias: string;
    phone?: string;
    customerName?: string;
    trigger?: string;
    webhookPayload?: any;
    webhookReceivedAt?: number;
  }) {
    this.id = uuidv4();
    this.tenantId = opts.tenantId;
    this.flowId = opts.flowId;
    this.flowAlias = opts.flowAlias;
    this.phone = opts.phone;
    this.customerName = opts.customerName;
    this.trigger = opts.trigger || "webhook";
    this.startedAt = Date.now();
    this.webhookPayload = opts.webhookPayload;
    this.webhookReceivedAt = opts.webhookReceivedAt;

    // Criar registro inicial no banco (async, não bloqueia)
    this._createInitial().catch(err =>
      logger.warn({ err: err.message, execId: this.id }, "Falha ao criar execução inicial")
    );
  }

  get executionId() { return this.id; }

  /** Registra resultado de um step */
  logStep(step: Omit<StepLog, "index">) {
    this.steps.push({
      ...step,
      index: this.steps.length,
    });
  }

  /** Helper: executa uma função e registra o step automaticamente */
  async trackStep<T>(type: string, label: string, fn: () => Promise<T>, input?: any): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      this.logStep({
        type, label, status: "ok",
        durationMs: Date.now() - start,
        input,
        output: typeof result === "object" ? summarize(result) : result,
      });
      return result;
    } catch (err: any) {
      this.logStep({
        type, label, status: "error",
        durationMs: Date.now() - start,
        input, error: err.message,
      });
      throw err;
    }
  }

  /** Marca como completo */
  async complete(status: ExecutionStatus = "completed") {
    await this._update(status);
  }

  /** Marca como falha */
  async fail(error: string) {
    await this._update("failed", error);
  }

  /** Marca como deferred (agendado pro scheduler) */
  async defer() {
    await this._update("deferred");
  }

  private async _createInitial() {
    try {
      await (await getPrisma()).execution.create({
        data: {
          id: this.id,
          tenantId: this.tenantId,
          flowId: this.flowId,
          flowAlias: this.flowAlias,
          phone: this.phone,
          customerName: this.customerName,
          status: "running",
          trigger: this.trigger,
          steps: [],
          startedAt: new Date(this.startedAt),
          webhookPayload: this.webhookPayload ? sanitizePayload(this.webhookPayload) : undefined,
          webhookReceivedAt: this.webhookReceivedAt ? new Date(this.webhookReceivedAt) : undefined,
        },
      });
    } catch (err: any) {
      logger.warn({ err: err.message, execId: this.id }, "Falha ao criar execução no banco");
    }
  }

  private async _update(status: ExecutionStatus, error?: string) {
    const now = Date.now();
    try {
      await (await getPrisma()).execution.update({
        where: { id: this.id },
        data: {
          status,
          steps: this.steps as any,
          error,
          completedAt: new Date(now),
          durationMs: now - this.startedAt,
        },
      });
    } catch (err: any) {
      logger.warn({ err: err.message, execId: this.id }, "Falha ao atualizar execução no banco");
    }
  }

  // --- Static queries ---

  /** Busca uma execução por ID */
  static async getById(executionId: string): Promise<ExecutionData | null> {
    try {
      const row = await (await getPrisma()).execution.findUnique({
        where: { id: executionId },
      });
      if (!row) return null;
      return { ...row, steps: row.steps as unknown as StepLog[] } as ExecutionData;
    } catch (err: any) {
      logger.warn({ err: err.message }, "Falha ao buscar execução");
      return null;
    }
  }

  /** Lista execuções de um tenant */
  static async list(tenantId: string, opts: {
    limit?: number;
    offset?: number;
    status?: ExecutionStatus;
    flowId?: string;
    phone?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {}): Promise<{ executions: ExecutionData[]; total: number }> {
    const { limit = 50, offset = 0, status, flowId, phone, dateFrom, dateTo } = opts;

    try {
      const where: any = { tenantId };
      if (status) where.status = status;
      if (flowId) where.flowId = flowId;
      if (phone) {
        // Match parcial pra facilitar busca (558688720061, 8688720061, etc)
        where.phone = { contains: phone.replace(/\D/g, "") };
      }
      if (dateFrom || dateTo) {
        where.startedAt = {};
        if (dateFrom) where.startedAt.gte = new Date(dateFrom);
        if (dateTo) where.startedAt.lte = new Date(dateTo + "T23:59:59.999Z");
      }

      const db = await getPrisma();
      const [executions, total] = await Promise.all([
        db.execution.findMany({
          where,
          orderBy: { startedAt: "desc" },
          skip: offset,
          take: limit,
        }),
        db.execution.count({ where }),
      ]);

      return {
        executions: executions.map((e: any) => ({ ...e, steps: e.steps as unknown as StepLog[] })) as ExecutionData[],
        total,
      };
    } catch (err: any) {
      logger.warn({ err: err.message }, "Falha ao listar execuções");
      return { executions: [], total: 0 };
    }
  }
}

/** Resumir objetos grandes */
function summarize(obj: any): any {
  if (!obj) return obj;
  const str = JSON.stringify(obj);
  if (str.length <= 500) return obj;
  return str.substring(0, 500) + "... (truncado)";
}

/** Limitar payload do webhook pra não estourar o banco */
function sanitizePayload(payload: any): any {
  const str = JSON.stringify(payload);
  if (str.length <= 10000) return payload;
  return { _truncated: true, size: str.length, preview: str.substring(0, 5000) };
}
