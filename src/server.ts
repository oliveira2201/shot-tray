import express from "express";
import { env } from "./config/env.js";
import { healthRouter } from "./routes/health.js";
import { visualizerRouter } from "./routes/visualizer.js";
import { webhooksRouter } from "./routes/webhooks.js";
import { logger } from "./utils/logger.js";

const app = express();

app.use(express.json({ limit: "2mb" }));
app.use(healthRouter);
app.use(webhooksRouter);
app.use(visualizerRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, "Erro não tratado");
  res.status(500).json({ error: "Erro interno" });
});

app.listen(env.PORT, () => {
  logger.info(`Servidor escutando na porta ${env.PORT}`);
});
