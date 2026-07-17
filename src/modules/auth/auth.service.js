import bcrypt from "bcryptjs";
import crypto from "crypto";
import { AppError } from "../../utils/AppError.js";
import { signAccessToken, signRefreshToken, verifyToken } from "../../utils/jwt.js";
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

// ─────────────────────────────────────────────────────────────────
// NUEVOS SERVICIOS: registro con OTP, verificación y reenvío
// ─────────────────────────────────────────────────────────────────

/**
 * Servicio de registro con OTP.
 * El rol se asigna automáticamente desde la BD buscando 'usuario corriente'.
 * 1. Resuelve el role_id del rol genérico.
 * 2. Hashea contraseña.
 * 3. Genera y hashea OTP de 6 dígitos.
 * 4. Llama al stored procedure que crea usuario (pending) + verify_email atómicamente.
 * 5. Envía el OTP en texto plano por correo.
 */
export const registerService = async ({ email, password }) => {
  // 1. Resolver el rol genérico desde la BD
  const role_id = await findRoleByName("usuario corriente");
  if (!role_id) {
    throw new AppError(
      "Rol por defecto no encontrado. Contacta con el administrador.",
      500,
    );
  }

  // 2. Hashear contraseña
  const password_hash = await bcrypt.hash(password, 10);

  // 3. Generar OTP seguro de 6 dígitos (100000–999999 inclusive)
  const otpPlain = String(crypto.randomInt(100000, 1000000));

  // 4. Hashear el OTP antes de persistirlo
  const otp_hash = await bcrypt.hash(otpPlain, 10);

  // 5. Llamar al stored procedure (maneja unique_violation internamente)
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
    // El SP lanza SQLSTATE 23505 cuando el email ya existe
    if (err.code === "23505") {
      throw new AppError("El correo electrónico ya está registrado", 409);
    }
    if (err.code === "23503") {
      throw new AppError("El rol especificado no existe", 400);
    }
    throw err;
  }

  // 6. Enviar OTP en texto plano
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
