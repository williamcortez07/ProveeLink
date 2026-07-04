import { logger } from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  // Registra el error interno con el logger, incluyendo detalles
  logger.error({
    err,
    path: req.path,
    method: req.method,
    body: req.body
  }, 'Error en la petición');

  // Si es un error de desarrollo y queremos ver detalles
  // Pero en general, NO filtramos detalles de la DB al cliente
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(err.status || 500).json({
    success: false,
    message: isProduction ? 'Error interno del servidor' : err.message,
    // Ocultar stack trace en producción
    ...(isProduction ? {} : { stack: err.stack })
  });
};
