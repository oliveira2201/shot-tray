import cors from "cors";
import express from "express";
import path from "path";
import { healthRouter } from "./routes/health.js";
import { visualizerRouter } from "./routes/visualizer.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { configApiRouter } from "./routes/api/config.js";
import { simulateApiRouter } from "./routes/api/simulate.js";
import { overviewApiRouter } from "./routes/api/overview.js";
import { tagsRouter } from "./routes/api/tags.js";
import { schedulerApiRouter } from "./routes/api/scheduler.js";
import { executionsApiRouter } from "./routes/api/executions.js";
import { adminTenantsRouter } from "./routes/api/admin/tenants.js";
import { adminTemplatesRouter } from "./routes/api/admin/templates.js";
import { adminFlowsRouter } from "./routes/api/admin/flows.js";
import { adminAdaptersRouter } from "./routes/api/admin/adapters.js";
import { requireAuth } from "./middleware/require-auth.js";
import { logger } from "./utils/logger.js";

export const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// Públicos (NÃO MUDAR ORDEM — webhooks antes do auth!)
app.use(healthRouter);
app.use(webhooksRouter);

// Admin protegido (requireAuth + rotas /api/admin/*)
app.use(requireAuth, adminTenantsRouter);
app.use(requireAuth, adminTemplatesRouter);
app.use(requireAuth, adminFlowsRouter);
app.use(requireAuth, adminAdaptersRouter);
app.use(requireAuth, configApiRouter);
app.use(requireAuth, simulateApiRouter);
app.use(requireAuth, overviewApiRouter);
app.use(requireAuth, tagsRouter);
app.use(requireAuth, schedulerApiRouter);
app.use(requireAuth, executionsApiRouter);

// SPA estático
app.use(visualizerRouter);

// Servir frontend React (build estático)
const publicDir = path.join(process.cwd(), "public");
app.use(express.static(publicDir));
app.get("/builder", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});
app.get("/builder/*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "Erro não tratado");
  res.status(500).json({ error: "Erro interno" });
});
