import bcrypt from "bcryptjs";
import crypto from "crypto";
import { AppError } from "../../utils/AppError.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyToken,
} from "../../utils/jwt.js";
import { sendOtpEmail } from "../../utils/mailer.js";
import {
  spRegisterUserInit,
  findActiveOtp,
  incrementFailedAttempts,
  markOtpUsedAndActivateUser,
  findUserByEmailForAuth,
  upsertOtpForResend,
  findRoleByName,
} from "./auth.repository.js";
import {
  getUserForAuth,
  getUserForAuthById,
  updateLastLogin,
} from "../users/userRepository.js";

export const loginService = async ({ email, password }) => {
  const user = await getUserForAuth(email);

  if (!user) {
    throw new AppError("Credenciales inválidas", 401);
  }
  if (user.status !== "active") {
    throw new AppError(
      "Tu cuenta no está activa. Contacta con el administrador.",
      403,
    );
  }
  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    throw new AppError("Credenciales inválidas", 401);
  }

  const tokenPayload = {
    id: user.id,
    email: user.email,
    role_id: user.role_id,
    role_name: user.role_name,
  };

  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken({ id: user.id });

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
// aqui se asigna el rol generico para usuario comun
export const registerService = async ({ email, password }) => {
  const role_id = await findRoleByName("Cliente");
  if (!role_id) {
    throw new AppError(
      "Rol por defecto no encontrado. Contacta con el administrador.",
      500,
    );
  }

  const password_hash = await bcrypt.hash(password, 10);
  const otpPlain = String(crypto.randomInt(100000, 1000000));

  const otp_hash = await bcrypt.hash(otpPlain, 10);
  let userId;
  try {
    userId = await spRegisterUserInit({
      role_id,
      email,
      password_hash,
      otp_hash,
      expires_minutes: 15,
    });
  } catch (err) {
    if (err.code === "23505") {
      throw new AppError("El correo electrónico ya está registrado", 409);
    }
    if (err.code === "23503") {
      throw new AppError("El rol especificado no existe", 400);
    }
    throw err;
  }

  await sendOtpEmail(email, otpPlain);

  return {
    message: "Registro exitoso. Revisa tu correo para verificar tu cuenta.",
    user_id: userId,
    email,
  };
};

/**
 * Servicio de verificación de email con OTP.
 * Compara el OTP en plano con el hash almacenado y activa la cuenta.
 * Retorna un access token para auto-login.
 */
export const verifyEmailService = async ({ email, otp }) => {
  // 1. Buscar registro activo (no expirado, no usado)
  const otpRecord = await findActiveOtp(email);

  if (!otpRecord) {
    throw new AppError(
      "No se encontró un código OTP activo para este correo. Puede haber expirado.",
      400,
    );
  }

  // 2. Comparar OTP en plano con el hash
  const isValid = await bcrypt.compare(otp, otpRecord.code_otp);

  if (!isValid) {
    await incrementFailedAttempts(otpRecord.id);
    throw new AppError("El código OTP es incorrecto.", 400);
  }

  // 3. Marcar OTP como usado y activar usuario (transacción)
  await markOtpUsedAndActivateUser(otpRecord.id, otpRecord.user_id);

  // 4. Obtener datos para el token
  const user = await findUserByEmailForAuth(email);

  if (!user) {
    throw new AppError("Usuario no encontrado.", 404);
  }

  // 5. Generar tokens para auto-login
  const tokenPayload = {
    id: user.id,
    email,
    role_id: user.role_id,
    role_name: user.role_name,
  };

  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken({ id: user.id });

  return {
    message: "Correo verificado exitosamente. ¡Bienvenido a ProveeLink!",
    accessToken,
    refreshToken,
    expiresIn: "24h",
  };
};

/**
 * Servicio de reenvío de OTP.
 * Solo para cuentas con status = 'pending'.
 * Genera un nuevo OTP, actualiza verify_email y envía el correo.
 */
/**
 * Servicio de actualización de tokens con rol vigente.
 * Lee el rol actual desde la base de datos y emite nuevos JWT.
 * Útil cuando el cliente tiene un token con rol desactualizado
 * (p.ej., después de crear una empresa sin haber recibido los nuevos tokens).
 *
 * @param {string} userId - UUID del usuario autenticado (obtenido de req.user)
 * @returns {{ accessToken: string, refreshToken: string, expiresIn: string, role_name: string }}
 */
export const upgradeRoleService = async (userId) => {
  const user = await getUserForAuthById(userId);

  if (!user) {
    throw new AppError("Usuario no encontrado.", 404);
  }

  if (user.status !== "active") {
    throw new AppError("La cuenta no está activa.", 403);
  }

  const tokenPayload = {
    id: user.id,
    email: user.email,
    role_id: user.role_id,
    role_name: user.role_name,
  };

  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken({ id: user.id });

  return {
    accessToken,
    refreshToken,
    expiresIn: "24h",
    role_name: user.role_name,
  };
};

export const resendOtpService = async ({ email }) => {
  // 1. Verificar que el usuario exista con status 'pending'
  const user = await findUserByEmailForAuth(email);

  if (!user) {
    throw new AppError("No existe una cuenta registrada con este correo.", 404);
  }

  if (user.status !== "pending") {
    throw new AppError(
      "Esta cuenta ya está activa o no requiere verificación.",
      400,
    );
  }

  // 2. Generar nuevo OTP
  const otpPlain = String(crypto.randomInt(100000, 1000000));
  const otp_hash = await bcrypt.hash(otpPlain, 10);

  // 3. Upsert del registro en verify_email (reset de expires_in y failed_attempts)
  await upsertOtpForResend({
    email,
    user_id: user.id,
    otp_hash,
    expires_minutes: 15,
  });

  // 4. Enviar el nuevo OTP por correo
  await sendOtpEmail(email, otpPlain);

  return {
    message: "Se ha enviado un nuevo código de verificación a tu correo.",
  };
};
