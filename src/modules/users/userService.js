import bcrypt from "bcrypt";
import * as userRepository from "../users/userRepository.js";
import * as roleRepository from "../roles/repositories/roleRepository.js";
import { AppError } from "../../utils/AppError.js";

const DEFAULT_STATUS = "active";
const SALT_ROUNDS = 12;
const ALLOWED_SORT_FIELDS = new Set([
  "first_name",
  "last_name",
  "email",
  "status",
  "created_at",
  "updated_at",
]);

export const createUserService = async (userData) => {
  const { email, role_id, password, ...rest } = userData;

  const role = await roleRepository.getRoleById(role_id);
  if (!role) {
    throw new AppError("El role especificado no existe", 400);
  }

  const existingUser = await userRepository.getUserByEmail(email);
  if (existingUser) {
    throw new AppError("El correo electrónico ya está registrado", 409);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const createdUser = await userRepository.createUser({
    ...rest,
    role_id,
    email,
    password_hash: passwordHash,
    status: DEFAULT_STATUS,
  });

  return createdUser;
};

export const getUsersService = async ({
  page,
  pageSize,
  sortBy,
  sortOrder,
  status,
  role_id,
}) => {
  const safeSortBy = ALLOWED_SORT_FIELDS.has(sortBy) ? sortBy : "created_at";
  const safeSortOrder = sortOrder === "asc" ? "asc" : "desc";
  const offset = (page - 1) * pageSize;

  const { data, total } = await userRepository.getUsers({
    limit: pageSize,
    offset,
    filters: { status, role_id },
    sortBy: safeSortBy,
    sortOrder: safeSortOrder,
  });

  return {
    data,
    pagination: {
      page,
      pageSize,
      totalItems: total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

export const searchUsersService = async ({ query, page, pageSize }) => {
  const offset = (page - 1) * pageSize;
  const { data, total } = await userRepository.searchUsers({
    query,
    limit: pageSize,
    offset,
  });

  return {
    data,
    pagination: {
      page,
      pageSize,
      totalItems: total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

export const getUserByIdService = async (id) => {
  const user = await userRepository.getUserById(id);
  if (!user) {
    throw new AppError("Usuario no encontrado", 404);
  }
  return user;
};

export const updateUserService = async (id, updateData) => {
  const user = await userRepository.getUserById(id);
  if (!user) {
    throw new AppError("Usuario no encontrado", 404);
  }

  if (updateData.role_id && updateData.role_id !== user.role_id) {
    const role = await roleRepository.getRoleById(updateData.role_id);
    if (!role) {
      throw new AppError("El role especificado no existe", 400);
    }
  }

  if (updateData.email && updateData.email !== user.email) {
    const existingUser = await userRepository.getUserByEmail(updateData.email);
    if (existingUser) {
      throw new AppError("El correo electrónico ya está registrado", 409);
    }
  }

  const fieldsToUpdate = { ...updateData };
  delete fieldsToUpdate.password;

  const updatedUser = await userRepository.updateUser(id, fieldsToUpdate);
  return updatedUser;
};

export const changeUserStatusService = async (id, status) => {
  const user = await userRepository.getUserById(id);
  if (!user) {
    throw new AppError("Usuario no encontrado", 404);
  }

  const currentStatus = user.status;
  const allowedTransitions = {
    active: ["inactive", "suspended"],
    inactive: ["active"],
    suspended: ["active"],
  };

  if (!allowedTransitions[currentStatus]?.includes(status)) {
    throw new AppError("Transición de estado no permitida", 400);
  }

  const updatedUser = await userRepository.updateUserStatus(id, status);
  return updatedUser;
};
