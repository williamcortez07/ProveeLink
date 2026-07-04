import { env } from './config/environment.js';
import app from './app.js';
import { pool, closePool } from './config/db.js';
import { logger } from './utils/logger.js';

const startServer = async () => {
  try {
    // Validar conexión a BD antes de levantar el server
    await pool.query('SELECT NOW()');
    logger.info(`Base de datos "${env.DB_NAME}" conectada correctamente`);

    const server = app.listen(env.PORT, () => {
      logger.info(`Servidor corriendo en http://localhost:${env.PORT}`);
    });

    // Graceful Shutdown
    const gracefulShutdown = async (signal) => {
      logger.info(`Señal ${signal} recibida, cerrando servidor...`);
      server.close(async () => {
        logger.info('Servidor HTTP cerrado.');
        await closePool();
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    logger.fatal({ err: error }, 'Error crítico al inicializar la aplicación');
    process.exit(1);
  }
};

startServer();
