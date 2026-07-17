import * as userService from "../users/userService.js";
import { asyncWrapper } from "../../utils/asyncWrapper.js";

export const createUser = asyncWrapper(async (req, res) => {
  const newUser = await userService.createUserService(req.body);
  res.status(201).json({
    success: true,
    message: "Usuario creado exitosamente",
    data: newUser,
  });
});

export const getUsers = asyncWrapper(async (req, res) => {
  const result = await userService.getUsersService(req.query);
  res.status(200).json({
    success: true,
    message: "Usuarios recuperados exitosamente",
    data: result.data,
    pagination: result.pagination,
  });
});

export const searchUsers = asyncWrapper(async (req, res) => {
  const result = await userService.searchUsersService(req.query);
  res.status(200).json({
    success: true,
    message: "Búsqueda de usuarios realizada con éxito",
    data: result.data,
    pagination: result.pagination,
  });
});

export const getUserById = asyncWrapper(async (req, res) => {
  const user = await userService.getUserByIdService(req.params.id);
  res.status(200).json({
    success: true,
    message: "Usuario encontrado exitosamente",
    data: user,
  });
});

export const updateUser = asyncWrapper(async (req, res) => {
  const updatedUser = await userService.updateUserService(
    req.params.id,
    req.body,
  );
  res.status(200).json({
    success: true,
    message: "Usuario actualizado exitosamente",
    data: updatedUser,
  });
});

export const changeUserStatus = asyncWrapper(async (req, res) => {
  const updatedUser = await userService.changeUserStatusService(
    req.params.id,
    req.body.status,
  );
  res.status(200).json({
    success: true,
    message: "Estado de usuario actualizado exitosamente",
    data: updatedUser,
  });
});

// ── Nuevo controlador: PUT /api/v1/users/profile ─────────────────

/**
 * PUT /api/v1/users/profile
 * Actualiza el perfil del usuario autenticado (first_name, last_name, phone).
 * Requiere JWT — el user_id se extrae de req.user.id (inyectado por authenticate).
 */
export const updateProfile = asyncWrapper(async (req, res) => {
  const updatedUser = await userService.updateProfileService(
    req.user.id,
    req.body,
  );
  res.status(200).json({
    success: true,
    message: "Perfil actualizado exitosamente",
    data: updatedUser,
  });
});
