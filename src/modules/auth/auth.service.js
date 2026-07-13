import bcrypt from "bcryptjs";
import { AppError } from "../../utils/AppError.js";
import { signAccessToken, signRefreshToken, verifyToken } from "../../utils/jwt.js";
import {
  getUserForAuth,
  getUserForAuthById,
  updateLastLogin,
} from "../users/userRepository.js";

/**
 * Servicio de login.
 * Valida credenciales, actualiza last_login_at y devuelve tokens.
 */
export const loginService = async ({ email, password }) => {
  // 1. Buscar usuario con sus credenciales y rol
  const user = await getUserForAuth(email);

  if (!user) {
    // Mismo mensaje para no revelar si el email existe o no
    throw new AppError("Credenciales inválidas", 401);
  }

  // 2. Verificar estado de la cuenta
  if (user.status !== "active") {
    throw new AppError(
      "Tu cuenta no está activa. Contacta con el administrador.",
      403,
    );
  }

  // 3. Comparar contraseña
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    throw new AppError("Credenciales inválidas", 401);
  }

  // 4. Generar tokens
  const tokenPayload = {
    id: user.id,
    email: user.email,
    role_id: user.role_id,
    role_name: user.role_name,
  };

  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken({ id: user.id });

  // 5. Actualizar last_login_at (no crítico, no bloquea la respuesta)
  await updateLastLogin(user.id);

  return {
    accessToken,
    refreshToken,
    expiresIn: "24h",
    user: {
      id: user.id,
      email: user.email,
      role_id: user.role_id,
      role_name: user.role_name,
    },
  };
};

/**
 * Servicio de renovación de access token usando el refresh token.
 * El refresh token solo contiene { id } como payload.
 */
export const refreshTokenService = async ({ refreshToken }) => {
  let decoded;

  try {
    decoded = verifyToken(refreshToken);
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw new AppError(
        "El refresh token ha expirado. Por favor inicia sesión nuevamente.",
        401,
      );
    }
    throw new AppError("Refresh token inválido.", 401);
  }

  // Obtener datos actualizados del usuario para el nuevo token
  const user = await getUserForAuthById(decoded.id);

  if (!user) {
    throw new AppError("Usuario no encontrado.", 401);
  }

  if (user.status !== "active") {
    throw new AppError("La cuenta no está activa.", 403);
  }

  const newAccessToken = signAccessToken({
    id: user.id,
    email: user.email,
    role_id: user.role_id,
    role_name: user.role_name,
  });

  return { accessToken: newAccessToken, expiresIn: "24h" };
};
