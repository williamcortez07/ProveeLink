import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import { z } from 'zod';
import { logger } from '../utils/logger.js';

const envSchema = z.object({
  PORT: z.string().default('3000').transform(Number),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  DB_HOST: z.string().min(1, 'DB_HOST es requerido'),
  DB_PORT: z.string().default('5432').transform(Number),
  DB_USER: z.string().min(1, 'DB_USER es requerido'),
  DB_PASSWORD: z.string().min(1, 'DB_PASSWORD es requerido'),
  DB_NAME: z.string().min(1, 'DB_NAME es requerido'),
  DB_SSL_REJECT_UNAUTHORIZED: z.string().default('1'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('24h'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  logger.error({
    msg: 'Variables de entorno inválidas',
    errors: _env.error.format()
  });
  process.exit(1);
}

export const env = _env.data;
