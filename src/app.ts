import cors from "cors";
import express from "express";
import { healthRouter } from "./routes/health.js";
import { visualizerRouter } from "./routes/visualizer.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { logger } from "./utils/logger.js";

export const app = express();

app.use(cors()); // Habilita chamadas de qualquer origem (arquivo local)
app.use(express.json({ limit: "2mb" }));
app.use(healthRouter);
app.use(webhooksRouter);
app.use(visualizerRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "Erro não tratado");
  res.status(500).json({ error: "Erro interno" });
});
