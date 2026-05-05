import { app } from "./app.js";
import { env } from "./config/env.js";
import { connectRedis } from "./lib/redis.js";
import { SchedulerService } from "./modules/scheduler/service.js";
import { restoreChoicesFromRedis } from "./modules/automation/engine/choice-listener.js";
import { startOAuthRefreshWorker } from "./modules/scheduler/oauth-refresh.js";
import { startAbandonedCartWorker } from "./modules/scheduler/abandoned-cart.js";
import { logger } from "./utils/logger.js";

const start = async () => {
    // Conectar Redis
    await connectRedis();

    // Inicializar Agendador
    await SchedulerService.init();

    // Restaurar choice listeners do Redis (sobrevive a restarts)
    await restoreChoicesFromRedis();

    // Worker de refresh de tokens OAuth (Tray)
    startOAuthRefreshWorker();

    // Worker de carrinho abandonado (Tray) — roda 8h/12h/18h BRT
    startAbandonedCartWorker();

    app.listen(env.PORT, () => {
        logger.info(`Servidor escutando na porta ${env.PORT}`);
    });
};

start();
