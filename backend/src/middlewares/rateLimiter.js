/**
 * Middleware de Rate Limiting en memoria para protección contra ataques de fuerza bruta y DoS.
 * Soporta ventanas de tiempo configurables y extracción segura de IP tras reverse proxies (trust proxy).
 */

export const createRateLimiter = ({
  windowMs = 15 * 60 * 1000, // 15 minutos por defecto
  max = 10,                   // Máximo de peticiones permitidas
  message = "Demasiadas solicitudes desde esta dirección. Por favor intenta más tarde.",
}) => {
  const hits = new Map(); // ip -> { count: number, resetTime: number }

  // Limpieza periódica para evitar fugas de memoria
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of hits.entries()) {
      if (now > record.resetTime) {
        hits.delete(ip);
      }
    }
  }, windowMs);

  // Desreferenciar para no impedir el apagado limpio del proceso
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return (req, res, next) => {
    // req.ip utiliza la IP real cuando app.set('trust proxy', 1) está configurado
    const clientIp = req.ip || req.connection?.remoteAddress || "unknown-ip";
    const now = Date.now();

    let record = hits.get(clientIp);

    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      hits.set(clientIp, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, max - record.count);
    const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(record.resetTime / 1000));

    if (record.count > max) {
      res.setHeader("Retry-After", retryAfterSeconds);
      return res.status(429).json({
        success: false,
        message,
        retryAfterSeconds,
      });
    }

    next();
  };
};

// ── Limitadores específicos según la sensibilidad del endpoint ──

// Login: máximo 10 intentos por cada 15 minutos
export const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Demasiados intentos de inicio de sesión. Por favor intenta nuevamente en 15 minutos.",
});

// Registro: máximo 5 cuentas creadas por hora por IP
export const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: "Has superado el límite de intentos de registro. Intenta más tarde.",
});

// Validación de OTP: máximo 5 intentos por cada 15 minutos por IP
export const otpLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Demasiados intentos de verificación de código OTP. Espera unos minutos antes de reintentar.",
});

// Reenvío de OTP: máximo 3 solicitudes por cada 15 minutos por IP (evita spam de emails)
export const resendOtpLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: "Has solicitado demasiados códigos recientemente. Por favor espera antes de pedir otro.",
});
