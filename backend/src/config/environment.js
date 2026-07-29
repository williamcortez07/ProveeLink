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
  DB_PORT: z.string().default('5434').transform(Number),
  DB_USER: z.string().min(1, 'DB_USER es requerido'),
  DB_PASSWORD: z.string().min(1, 'DB_PASSWORD es requerido'),
  DB_NAME: z.string().min(1, 'DB_NAME es requerido'),
  DB_SSL_REJECT_UNAUTHORIZED: z.string().default('1'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_EXPIRES_IN: z.string().default('24h'),

  // ── SMTP (Nodemailer) ──────────────────────────────────────────
  MAIL_HOST: z.string().min(1, 'MAIL_HOST es requerido'),
  MAIL_PORT: z.string().default('465').transform(Number),
  MAIL_SECURE: z.string().default('true').transform((v) => v === 'true'),
  MAIL_USER: z.string().min(1, 'MAIL_USER es requerido'),
  MAIL_PASS: z.string().min(1, 'MAIL_PASS es requerido'),
  MAIL_FROM: z.string().min(1, 'MAIL_FROM es requerido'),

  // ── CORS ───────────────────────────────────────────────────────
  // Orígenes separados por coma, o '*' para permitir todos.
  CORS_ORIGIN: z.string().default('*'),
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
