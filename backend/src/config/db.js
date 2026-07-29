import pg from 'pg';
import { env } from './environment.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

// Configuración segura del pool
const poolConfig = {
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,

  // Limita el número máximo de clientes para evitar saturar la base de datos
  max: 20,

  // Cierra conexiones inactivas después de 30 segundos
  idleTimeoutMillis: 30000,

  // Falla rápido si la conexión no se establece en 5 segundos
  connectionTimeoutMillis: 5000,
};

// Configuración SSL para producción
if (env.NODE_ENV === 'production') {
  poolConfig.ssl = {
    rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED === '1'
  };
}

const pool = new Pool(poolConfig);

pool.on('connect', (client) => {
  logger.debug('Nueva conexión a PostgreSQL establecida');
});

// Captura errores inesperados en conexiones ociosas
pool.on('error', (err, client) => {
  logger.error({ err }, 'Error inesperado en el pool de PostgreSQL');
});

// Función de consulta con retry (backoff exponencial)
const queryWithRetry = async (text, params, retries = 3) => {
  let currentTry = 0;

  while (currentTry < retries) {
    try {
      // Uso de prepared statements (al pasar "params" pg los parametriza)
      const res = await pool.query(text, params);
      return res;
    } catch (error) {
      currentTry++;

      logger.error({
        msg: `Fallo en consulta BD, reintento ${currentTry}/${retries}`,
        query: text,
        error: error.message
      });

      if (currentTry === retries) {
        throw error;
      }

      // Backoff exponencial: 100ms, 200ms, 400ms...
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, currentTry) * 50));
    }
  }
};

// Cierre gracefully del pool
const closePool = async () => {
  try {
    await pool.end();
    logger.info('Pool de conexiones a PostgreSQL cerrado correctamente');
  } catch (err) {
    logger.error({ err }, 'Error al cerrar el pool de PostgreSQL');
  }
};

export {
  pool,
  queryWithRetry as query,
  closePool
};
