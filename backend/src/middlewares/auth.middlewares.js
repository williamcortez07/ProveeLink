import { verifyToken } from "../utils/jwt.js";
import { AppError } from "../utils/AppError.js";
import { asyncWrapper } from "../utils/asyncWrapper.js";

/**
 * Middleware de autenticación.
 * Verifica el Bearer token JWT y adjunta el payload a req.user.
 */
export const authenticate = asyncWrapper(async (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AppError(
      "Acceso denegado. Se requiere un token de autenticación.",
      401,
    );
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyToken(token);
    req.user = decoded; // { id, email, role_id, role_name, iat, exp }
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw new AppError("El token ha expirado. Por favor inicia sesión nuevamente.", 401);
    }
    throw new AppError("Token inválido o malformado.", 401);
  }
});

/**
 * Middleware de autorización por nombre de rol.
 * Debe usarse DESPUÉS de authenticate.
 * @param  {...string} allowedRoles - Nombres de roles permitidos (case-insensitive)
 */
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError("No autenticado.", 401));
    }

    const userRole = (req.user.role_name || "").toUpperCase();
    const allowed = allowedRoles.map((r) => r.toUpperCase());

    if (!allowed.includes(userRole)) {
      return next(
        new AppError(
          "No tienes permisos suficientes para realizar esta acción.",
          403,
        ),
      );
    }

    next();
  };
};
