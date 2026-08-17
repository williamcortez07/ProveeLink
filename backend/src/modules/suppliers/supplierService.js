import * as supplierRepository from "../suppliers/supplierRepository.js";
import * as companyrepository from "../companies/companyRepository.js";
import { AppError } from "../../utils/AppError.js";

const DEFAULT_STATUS = "active";
const ALLOWED_SORT_FIELDS = new Set([
  "supplier_type",
  "service_description",
  "geographic_coverage",
  "operating_hours",
  "status",
  "created_at",
  "updated_at",
]);

import { findRoleByName } from "../auth/auth.repository.js";
import { updateUserRole } from "../users/userRepository.js";
import { signAccessToken, signRefreshToken } from "../../utils/jwt.js";

export const createSupplierService = async (supplierData) => {
  const { company_id, ...rest } = supplierData;
  const company = await companyrepository.getCompanyById(company_id);
  if (!company) {
    throw new AppError("La empresa especificada no existe en nuestro sistema", 404);
  }

  const createdSupplier = await supplierRepository.createSupplier({
    ...rest,
    company_id,
    status: DEFAULT_STATUS,
  });

  // Intentar actualizar el rol del usuario a Proveedor si existe
  let tokens = null;
  const supplierRoleId = (await findRoleByName("Proveedor")) || (await findRoleByName("Proveedores"));
  if (supplierRoleId && company.user_id) {
    try {
      const updatedUser = await updateUserRole(company.user_id, supplierRoleId);
      if (updatedUser) {
        const tokenPayload = {
          id: updatedUser.id,
          email: updatedUser.email,
          role_id: updatedUser.role_id,
          role_name: updatedUser.role_name,
        };
        const accessToken = signAccessToken(tokenPayload);
        const refreshToken = signRefreshToken({ id: updatedUser.id });
        tokens = {
          accessToken,
          refreshToken,
          expiresIn: "24h",
          role_name: updatedUser.role_name,
        };
      }
    } catch {
      // Ignorar si el rol de usuario ya estaba asignado
    }
  }

  return { supplier: createdSupplier, tokens };
};

export const getSupplierByCompanyIdService = async (companyId) => {
  return supplierRepository.getSupplierByCompanyId(companyId);
};

export const getSuppliersService = async ({
  page,
  pageSize,
  sortBy,
  sortOrder,
  status,
  company_id,
  category_id,
}) => {
  const safeSortby = ALLOWED_SORT_FIELDS.has(sortBy) ? sortBy : "created_at";
  const safeSortOrder = sortOrder === "asc" ? "asc" : "desc";
  const offset = (page - 1) * pageSize;

  const { data, total } = await supplierRepository.getSuppliers({
    limit: pageSize,
    offset,
    filters: { status, company_id, category_id },
    sortBy: safeSortby,
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

export const searchSupplierService = async ({ query, page, pageSize }) => {
  const offset = (page - 1) * pageSize;
  const { data, total } = await supplierRepository.searchSupplier({
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

export const getSupplierByIdService = async (id) => {
  const supplier = await supplierRepository.getSupplierById(id);
  if (!supplier) {
    throw new AppError("Proveedor no encontrado", 404);
  }
  return supplier;
};

export const updateSupplierService = async (id, updateData) => {
  const supplier = await supplierRepository.getSupplierById(id);
  if (!supplier) {
    throw new AppError("Proveedor no encontrado", 404);
  }

  if (updateData.company_id && updateData.company_id !== supplier.company_id) {
    const company = await companyrepository.getCompanyById(
      updateData.company_id,
    );
    if (!company) {
      throw new AppError(
        "La empresa especificada no existe en nuestro sistema",
        400,
      );
    }
  }

  const updateSupplier = await supplierRepository.updateSupplier(id, updateData);
  return updateSupplier;
};

export const changeSupplierStatus = async (id, status) => {
  const supplier = await supplierRepository.getSupplierById(id);
  if (!supplier) {
    throw new AppError("Proveedor no encontrado", 404);
  }
  const currentStatus = supplier.status;
  const allowedTransitions = {
    active: ["inactive", "suspended"],
    inactive: ["active"],
    suspended: ["active"],
  };
  if (!allowedTransitions[currentStatus]?.includes(status)) {
    throw new AppError(
      `Transición de estado no permitida: ${currentStatus} → ${status}`,
      400,
    );
  }
  const updatedSupplier = await supplierRepository.updateSupplierStatus(id, status);
  return updatedSupplier;
};
