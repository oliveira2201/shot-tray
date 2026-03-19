import { Router } from "express";
import { SchedulerService } from "../../modules/scheduler/service.js";

export const schedulerApiRouter = Router();

// GET /api/scheduler/jobs — jobs pendentes
schedulerApiRouter.get("/api/scheduler/jobs", async (_req, res) => {
  const jobs = await SchedulerService.getPendingJobs();
  res.json({
    count: jobs.length,
    jobs: jobs.map(j => ({
      id: j.id,
      tenantId: j.tenantId,
      flowAlias: j.flowAlias,
      status: j.status,
      executeAt: j.executeAt,
      executeIn: Math.max(0, Math.round((j.executeAt - Date.now()) / 1000)) + "s",
      phone: j.context?.number,
      cancelIfTags: j.cancelIfTags,
      stepsCount: j.remainingSteps?.length || 0,
      createdAt: j.createdAt,
    })),
  });
});

// GET /api/scheduler/logs?limit=50 — logs recentes
schedulerApiRouter.get("/api/scheduler/logs", async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const logs = await SchedulerService.getLogs(limit);
  res.json({ count: logs.length, logs });
});

// GET /api/scheduler/stats — contadores
schedulerApiRouter.get("/api/scheduler/stats", async (_req, res) => {
  const stats = await SchedulerService.getStats();
  res.json(stats);
});

// DELETE /api/scheduler/jobs/:jobId — cancelar job
schedulerApiRouter.delete("/api/scheduler/jobs/:jobId", async (req, res) => {
  const ok = await SchedulerService.cancelJob(req.params.jobId);
  res.json({ ok, jobId: req.params.jobId });
});
