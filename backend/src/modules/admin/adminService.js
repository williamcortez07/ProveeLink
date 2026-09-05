import bcrypt from "bcryptjs";
import { AppError } from "../../utils/AppError.js";
import * as adminRepository from "./adminRepository.js";
import * as userRepository from "../users/userRepository.js";
import * as roleRepository from "../roles/repositories/roleRepository.js";

const SALT_ROUNDS = 12;

// ─────────────────────────────────────────────────────────────────────────────
// ESTADÍSTICAS
// ─────────────────────────────────────────────────────────────────────────────

export const getDashboardStatsService = async () => {
  return adminRepository.getDashboardStats();
};

// ─────────────────────────────────────────────────────────────────────────────
// GESTIÓN DE USUARIOS
// ─────────────────────────────────────────────────────────────────────────────

export const getAllUsersService = async ({
  page = 1,
  limit = 10,
  status,
  role_id,
  search,
  sortBy,
  sortOrder,
}) => {
  const offset = (page - 1) * limit;
  const { data, total } = await adminRepository.getAllUsers({
    limit,
    offset,
    status,
    role_id,
    search,
    sortBy,
    sortOrder,
  });

  return {
    data,
    pagination: {
      page,
      limit,
      totalItems: total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const changeUserStatusService = async (adminId, userId, status) => {
  // No permite que un admin se desactive a sí mismo
  if (adminId === userId && status !== "active") {
    throw new AppError("No puedes cambiar el estado de tu propia cuenta.", 403);
  }

  const user = await userRepository.getUserById(userId);
  if (!user) {
    throw new AppError("Usuario no encontrado.", 404);
  }

  const allowedTransitions = {
    active: ["inactive", "suspended"],
    inactive: ["active"],
    suspended: ["active"],
  };

  if (!allowedTransitions[user.status]?.includes(status)) {
    throw new AppError("Transición de estado no permitida.", 400);
  }

  return userRepository.updateUserStatus(userId, status);
};

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICACIONES DE EMPRESAS
// ─────────────────────────────────────────────────────────────────────────────

export const getVerificationsService = async ({
  page = 1,
  limit = 10,
  status = "pending",
  search,
}) => {
  const offset = (page - 1) * limit;
  const { data, total } = await adminRepository.getVerifications({
    limit,
    offset,
    status,
    search,
  });

  return {
    data,
    pagination: {
      page,
      limit,
      totalItems: total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getCompanyDetailService = async (companyId) => {
  const company = await adminRepository.getCompanyById(companyId);
  if (!company) {
    throw new AppError("Empresa no encontrada.", 404);
  }
  return company;
};

export const approveVerificationService = async (companyId) => {
  const company = await adminRepository.getCompanyById(companyId);
  if (!company) {
    throw new AppError("Empresa no encontrada.", 404);
  }
  if (company.verification_status === "verified") {
    throw new AppError("Esta empresa ya está verificada.", 400);
  }
  return adminRepository.updateCompanyVerification(companyId, "verified");
};

export const rejectVerificationService = async (companyId) => {
  const company = await adminRepository.getCompanyById(companyId);
  if (!company) {
    throw new AppError("Empresa no encontrada.", 404);
  }
  if (company.verification_status === "rejected") {
    throw new AppError("Esta empresa ya fue rechazada.", 400);
  }
  return adminRepository.updateCompanyVerification(companyId, "rejected");
};

// ─────────────────────────────────────────────────────────────────────────────
// GESTIÓN DE ADMINISTRADORES
// ─────────────────────────────────────────────────────────────────────────────

export const getAdministratorsService = async ({ page = 1, limit = 20 }) => {
  const offset = (page - 1) * limit;
  const { data, total } = await adminRepository.getAdministrators({ limit, offset });

  return {
    data,
    pagination: {
      page,
      limit,
      totalItems: total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const createAdministratorService = async (adminData) => {
  const { email, password, first_name, last_name, phone } = adminData;

  // 1. Obtener el rol Admin
  const adminRoleId = await adminRepository.getAdminRoleId();
  if (!adminRoleId) {
    throw new AppError(
      "El rol 'Admin' no existe en el sistema. Contacta al equipo técnico.",
      500,
    );
  }

  // 2. Verificar que el email no exista
  const existing = await userRepository.getUserByEmail(email);
  if (existing) {
    throw new AppError("El correo electrónico ya está registrado.", 409);
  }

  // 3. Hashear contraseña
  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  // 4. Crear el usuario directamente con status='active' y rol Admin
  const newAdmin = await userRepository.createUser({
    role_id: adminRoleId,
    first_name,
    last_name,
    email,
    phone: phone ?? null,
    password_hash,
    profile_picture_url: null,
    status: "active",
  });

  return newAdmin;
};
