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

  // Si el error tiene un status definido, es un AppError controlado:
  // se puede mostrar el mensaje al cliente de forma segura.
  // Si NO tiene status (crash inesperado de Node/DB), se oculta el detalle.
  const isControlledError = typeof err.status === 'number';

  res.status(err.status || 500).json({
    success: false,
    message: (isProduction && !isControlledError)
      ? 'Error interno del servidor'
      : err.message,
    ...(isProduction ? {} : { stack: err.stack }),
  });
};
