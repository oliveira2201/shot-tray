import { app } from "./app.js";
import { env } from "./config/env.js";
import { connectRedis } from "./lib/redis.js";
import { SchedulerService } from "./modules/scheduler/service.js";
import { logger } from "./utils/logger.js";

const start = async () => {
    // Conectar Redis
    await connectRedis();

    // Inicializar Agendador
    await SchedulerService.init();

    app.listen(env.PORT, () => {
        logger.info(`Servidor escutando na porta ${env.PORT}`);
    });
};

start();
