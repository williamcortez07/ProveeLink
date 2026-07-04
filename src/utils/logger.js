import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  redact: {
    paths: ['password', 'token', 'authorization', 'secret'],
    censor: '[OCULTADO]'
  }
});
