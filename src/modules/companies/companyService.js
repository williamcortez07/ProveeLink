import * as companyRepository from "../companies/companyRepository.js";
import { AppError } from "../../utils/AppError.js";

const ALLOWED_SORT_FIELDS = new Set([
  "name",
  "description",
  "tax_id",
  "phone",
  "email",
  "address",
  "state_province",
  "city",
  "logo_url",
  "website_url",
  "verification_status",
  "created_at",
  "updated_at",
]);

export const createCompanyService = async (companyData) => {
  const { email, user_id, ...rest } = companyData;
  const user = await userRepository.getUserById(user_id);
  if (!user) {
    throw new AppError("El usuario especificado no existe", 400);
  }
  const existingCompany = await companyRepository.getCompanyByEmail(email);
  if (existingCompany) {
    throw new AppError("El correo electrónico ya está registrado", 409);
  }
  const createdCompany = await companyRepository.createCompany({
    ...rest,
    user_id,
    email,
  });
  return createdCompany;
};

export const getCompanyService = async ({
  page,
  pageSize,
  sortBy,
  sortOrder,
  status,
  user_id,
}) => {
  const safeSortBy = ALLOWED_SORT_FIELDS.has(sortBy) ? sortBy : "created_at";
  const safeSortOrder = sortOrder === "asc" ? "asc" : "desc";
  const offset = (page - 1) * pageSize;

  const { data, total } = await companyRepository.getCompany({
    limit: pageSize,
    offset,
    filters: { status, user_id },
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

export const searchCompaniesService = async ({ query, page, pageSize }) => {
  const offset = (page - 1) * pageSize;
  const { data, total } = await companyRepository.searchCompanies({
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

export const getCompanyByIdService = async (id) => {
  const company = await companyRepository.getCompanyById(id);
  if (!company) {
    throw new AppError("Empresa no encontrada", 404);
  }
  return company;
};

export const updateCompanyService = async (id, updateData) => {
  const company = await companyRepository.getCompanyById(id);
  if (!company) {
    throw new AppError("Empresa no encontrada", 404);
  }

  // Whitelist explícito: solo campos de negocio editables
  const ALLOWED_UPDATE_FIELDS = [
    "name",
    "description",
    "tax_id",
    "phone",
    "email",
    "address",
    "state_province",
    "city",
    "logo_url",
    "website_url",
  ];

  const sanitizedData = Object.fromEntries(
    Object.entries(updateData).filter(
      ([key, value]) => ALLOWED_UPDATE_FIELDS.includes(key) && value !== undefined,
    ),
  );

  if (Object.keys(sanitizedData).length === 0) {
    throw new AppError("Debe proporcionar al menos un campo válido para actualizar", 400);
  }

  if (sanitizedData.email && sanitizedData.email !== company.email) {
    const existingCompany = await companyRepository.getCompanyByEmail(
      sanitizedData.email,
    );
    if (existingCompany) {
      throw new AppError("El correo electrónico ya está registrado", 409);
    }
  }

  const updatedCompany = await companyRepository.updateCompany(id, sanitizedData);
  return updatedCompany;
};
