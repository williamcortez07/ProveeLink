import { logger } from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  // Registra el error interno con el logger, incluyendo detalles completos
  logger.error({
    err,
    path: req.path,
    method: req.method,
    // Omitimos body para no loggear contraseñas; solo loggeamos en desarrollo
    ...(process.env.NODE_ENV !== 'production' && { body: req.body }),
  }, 'Error en la petición');

  const isProduction = process.env.NODE_ENV === 'production';
  const isControlledError = typeof err.status === 'number';

  // Solo exponer el mensaje si es un AppError controlado con status HTTP explícito.
  // Cualquier excepción no controlada (errores SQL, crashes, paths) devuelve mensaje genérico.
  const safeMessage = isControlledError
    ? err.message
    : 'Error interno del servidor';

  res.status(err.status || 500).json({
    success: false,
    message: safeMessage,
  });
};
