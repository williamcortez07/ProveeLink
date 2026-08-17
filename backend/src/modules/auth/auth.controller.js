import * as authService from "./auth.service.js";
import { asyncWrapper } from "../../utils/asyncWrapper.js";

export const login = asyncWrapper(async (req, res) => {
  const result = await authService.loginService(req.body);
  res.status(200).json({
    success: true,
    message: "Inicio de sesión exitoso",
    data: result,
  });
});

export const refreshToken = asyncWrapper(async (req, res) => {
  const result = await authService.refreshTokenService(req.body);
  res.status(200).json({
    success: true,
    message: "Token renovado exitosamente",
    data: result,
  });
});

export const logout = asyncWrapper(async (req, res) => {
  res.status(200).json({
    success: true,
    message: "Sesión cerrada exitosamente. Descarta tus tokens en el cliente.",
  });
});

export const getMe = asyncWrapper(async (req, res) => {
  res.status(200).json({
    success: true,
    message: "Perfil del usuario autenticado",
    data: req.user,
  });
});

export const register = asyncWrapper(async (req, res) => {
  const result = await authService.registerService(req.body);
  res.status(201).json({
    success: true,
    message: result.message,
    data: { user_id: result.user_id, email: result.email },
  });
});

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

export const resendOtp = asyncWrapper(async (req, res) => {
  const result = await authService.resendOtpService(req.body);
  res.status(200).json({
    success: true,
    message: result.message,
  });
});

export const upgradeRole = asyncWrapper(async (req, res) => {
  const result = await authService.upgradeRoleService(req.user.id);
  res.status(200).json({
    success: true,
    message: `Tokens actualizados. Rol vigente: ${result.role_name}`,
    data: {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      role_name: result.role_name,
    },
  });
});
