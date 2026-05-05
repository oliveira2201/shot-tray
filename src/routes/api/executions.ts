import { Router, Request, Response } from "express";
import { ExecutionTracker } from "../../modules/execution/tracker.js";
import type { ExecutionStatus } from "../../modules/execution/tracker.js";

export const executionsApiRouter = Router();

/** Lista execuções de um tenant com filtros */
executionsApiRouter.get("/api/admin/executions/:tenantId", async (req: Request, res: Response): Promise<any> => {
  const tenantId = req.params.tenantId as string;
  const limit = req.query.limit as string | undefined;
  const offset = req.query.offset as string | undefined;
  const status = req.query.status as string | undefined;
  const flowId = req.query.flowId as string | undefined;
  const phone = req.query.phone as string | undefined;
  const dateFrom = req.query.dateFrom as string | undefined;
  const dateTo = req.query.dateTo as string | undefined;

  try {
    const result = await ExecutionTracker.list(tenantId, {
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
      status: status as ExecutionStatus | undefined,
      flowId,
      phone,
      dateFrom,
      dateTo,
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** Detalhe de uma execução */
executionsApiRouter.get("/api/admin/executions/:tenantId/:executionId", async (req: Request, res: Response): Promise<any> => {
  const executionId = req.params.executionId as string;

  try {
    const execution = await ExecutionTracker.getById(executionId);
    if (!execution) {
      return res.status(404).json({ error: "Execution not found" });
    }
    res.json(execution);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
