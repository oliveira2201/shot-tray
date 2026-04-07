import cors from "cors";
import express from "express";
import path from "path";
import { healthRouter } from "./routes/health.js";
import { visualizerRouter } from "./routes/visualizer.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { flowsApiRouter } from "./routes/api/flows.js";
import { configApiRouter } from "./routes/api/config.js";
import { simulateApiRouter } from "./routes/api/simulate.js";
import { templatesApiRouter } from "./routes/api/templates.js";
import { overviewApiRouter } from "./routes/api/overview.js";
import { tagsRouter } from "./routes/api/tags.js";
import { schedulerApiRouter } from "./routes/api/scheduler.js";
import { executionsApiRouter } from "./routes/api/executions.js";
import { logger } from "./utils/logger.js";

export const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(healthRouter);
app.use(webhooksRouter);
app.use(flowsApiRouter);
app.use(configApiRouter);
app.use(simulateApiRouter);
app.use(templatesApiRouter);
app.use(overviewApiRouter);
app.use(tagsRouter);
app.use(schedulerApiRouter);
app.use(executionsApiRouter);
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
