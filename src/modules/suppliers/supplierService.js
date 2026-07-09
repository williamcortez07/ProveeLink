import * as supplierRepository from "../suppliers/supplierRepository.js";
import * as companyrepository from "../companies/companyRepository.js";
import { AppError } from "../../utils/AppError";
import { query } from "../../config/db.js";

const DEFAULT_STATUS = "activo";
const ALLOWED_SORT_FIELDS = new set([
  "supplier_type",
  "service_description",
  "geographic_coverage",
  "operating_hours",
  "status",
  "created_at",
  "updated_at",
]);

export const createSupplierService = async (supplierData) => {
  const { company_id, ...rest } = supplierData;
  const company = await companyrepository.getCompanyById(company_id);
  if (!company) {
    throw new AppError("La empresa especificada no existe en nuestro sistema");
  }

  const createSupplier = await supplierRepository.createSupplier({
    ...rest,
    company_id,
    status: DEFAULT_STATUS,
  });
  return createSupplier;
};

export const getSuppliersService = async ({
  page,
  pageSize,
  sortBy,
  sortOrder,
  status,
  company_id,
}) => {
  const safeSortby = ALLOWED_SORT_FIELDS.has(sortBy) ? sortBy : "created_at";
  const safeSortOrder = sortOrder === "asc" ? "asc" : "desc";
  const offset = (page - 1) * pageSize;

  const { data, total } = await supplierRepository.getSuppliers({
    limit: pageSize,
    offset,
    filters: { status, company_id },
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

  const updateSupplier = await supplierRepository.updateSupplier(id);
  return updateSupplier;
};

export const changeSupplierStatus = async (id, status) => {
  const supplier = await supplierRepository.getCompanyById(id);
  if (!supplier) {
    throw new AppError("Proveedor no encontrado", 404);
  }
  const currentStatus = supplier.status;
  const allowedTrasitions = {
    activo: ["inactivo", "suspendido"],
    inactivo: ["activo"],
    suspendido: ["activo"],
  };
  if (!allowedTrasitions[currentStatus]?.includes(status)) {
    throw new AppError("Transición de estado no permitida", 400);
  }
  const updatedSupplier = await supplierRepository.updateSupplier(id, status);
  return updatedSupplier;
};
