import * as authService from "./auth.service.js";
import { asyncWrapper } from "../../utils/asyncWrapper.js";

/**
 * POST /api/v1/auth/login
 */
export const login = asyncWrapper(async (req, res) => {
  const result = await authService.loginService(req.body);
  res.status(200).json({
    success: true,
    message: "Inicio de sesión exitoso",
    data: result,
  });
});

/**
 * POST /api/v1/auth/refresh
 */
export const refreshToken = asyncWrapper(async (req, res) => {
  const result = await authService.refreshTokenService(req.body);
  res.status(200).json({
    success: true,
    message: "Token renovado exitosamente",
    data: result,
  });
});

/**
 * POST /api/v1/auth/logout
 * Stateless logout: el cliente descarta los tokens.
 * Aquí podría implementarse una blacklist si se requiere.
 */
export const logout = asyncWrapper(async (req, res) => {
  res.status(200).json({
    success: true,
    message: "Sesión cerrada exitosamente. Descarta tus tokens en el cliente.",
  });
});

/**
 * GET /api/v1/auth/me
 * Devuelve el perfil del usuario autenticado desde el token.
 */
export const getMe = asyncWrapper(async (req, res) => {
  res.status(200).json({
    success: true,
    message: "Perfil del usuario autenticado",
    data: req.user,
  });
});

// ─────────────────────────────────────────────────────────────────
// NUEVOS CONTROLADORES: registro OTP, verificación y reenvío
// ─────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/auth/register
 * Registra un usuario con status 'pending' y envía OTP por correo.
 */
export const register = asyncWrapper(async (req, res) => {
  const result = await authService.registerService(req.body);
  res.status(201).json({
    success: true,
    message: result.message,
    data: { user_id: result.user_id, email: result.email },
  });
});

/**
 * POST /api/v1/auth/verify
 * Verifica el OTP, activa la cuenta y retorna tokens para auto-login.
 */
export const verifyEmail = asyncWrapper(async (req, res) => {
  const result = await authService.verifyEmailService(req.body);
  res.status(200).json({
    success: true,
    message: result.message,
    data: {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    },
  });
});

/**
 * POST /api/v1/auth/resend-otp
 * Genera y reenvía un nuevo OTP para cuentas en estado 'pending'.
 */
export const resendOtp = asyncWrapper(async (req, res) => {
  const result = await authService.resendOtpService(req.body);
  res.status(200).json({
    success: true,
    message: result.message,
  });
});
