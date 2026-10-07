import { verifyToken } from "../utils/jwt.js";
import { AppError } from "../utils/AppError.js";
import { asyncWrapper } from "../utils/asyncWrapper.js";
import { getUserForAuthById } from "../modules/users/userRepository.js";

/**
 * Middleware de autenticación.
 * Verifica el Bearer token JWT y valida que el usuario siga existiendo y esté activo en la BD.
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

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw new AppError("El token ha expirado. Por favor inicia sesión nuevamente.", 401);
    }
    throw new AppError("Token inválido o malformado.", 401);
  }

  // Verificación en base de datos para prevenir privilegios desactualizados o cuentas desactivadas
  const user = await getUserForAuthById(decoded.id);
  if (!user) {
    throw new AppError("Usuario no encontrado o dado de baja.", 401);
  }

  if (user.status !== "active") {
    throw new AppError("Tu cuenta no se encuentra activa. Contacta al administrador.", 403);
  }

  // Usar datos frescos de la BD para req.user (evita confiar únicamente en el payload del JWT)
  req.user = {
    id: user.id,
    email: user.email,
    role_id: user.role_id,
    role_name: user.role_name,
  };

  next();
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
