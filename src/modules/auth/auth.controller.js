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
