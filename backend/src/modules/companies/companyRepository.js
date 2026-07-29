import { query } from "../../config/db.js";
import { logger } from "../../utils/logger.js";
import { AppError } from "../../utils/AppError.js";

const companyColumns = [
  "c.id",
  "c.user_id",
  "c.name",
  "c.description",
  "c.tax_id",
  "c.phone",
  "c.email",
  "c.address",
  "c.state_province",
  "c.city",
  "c.logo_url",
  "c.website_url",
  "c.verification_status",
  "c.created_at",
  "c.updated_at",
].join(", ");

const mapCompanyRow = (row) => ({
  id: row.id,
  user_id: row.user_id,
  name: row.name,
  description: row.description,
  tax_id: row.tax_id,
  phone: row.phone,
  email: row.email,
  address: row.address,
  state_province: row.state_province,
  city: row.city,
  logo_url: row.logo_url,
  website_url: row.website_url,
  verification_status: row.verification_status,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export const createCompany = async ({
  user_id,
  name,
  description,
  tax_id,
  phone = null,
  email,
  address,
  state_province,
  city,
  logo_url = null,
  website_url = null,
}) => {
  try {
    const sql = `
        INSERT INTO public.companies(
            user_id, name, description, tax_id, phone, email, address, state_province, city, logo_url, website_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id;
        `;
    const result = await query(sql, [
      user_id,
      name,
      description,
      tax_id,
      phone,
      email,
      address,
      state_province,
      city,
      logo_url,
      website_url,
    ]);
    const newId = result.rows[0].id;
    return getCompanyById(newId);
  } catch (err) {
    if (err.code === "23505") {
      logger.warn({ email }, "intento de registro con email duplicado");
      throw new AppError("El correo electrónico ya está registrado", 409);
    }
    if (err.code === "23503") {
      logger.warn({ user_id }, "FK violation al crear empresas");
      throw new AppError("El usuario especificado no existe", 400);
    }
    if (err instanceof AppError) throw err;
    logger.error(
      { err, user_id, email },
      "Error inesperado al registrar la empresa",
    );
    throw new Error(
      "Error al registrar la empresa/compañía en la base de datos",
    );
  }
};

export const getCompany = async ({
  limit = 10,
  offset = 0,
  filters = {},
  sortBy = "created_at",
  sortOrder = "desc",
}) => {
  try {
    const params = [];
    const conditions = [];
    if (filters.status) {
      params.push(filters.status);
      conditions.push(`c.verification_status = $${params.length}`);
    }
    if (filters.user_id) {
      params.push(filters.user_id);
      conditions.push(`c.user_id = $${params.length}`);
    }
    let sql = `
    SELECT ${companyColumns}, COUNT(*) OVER() AS total_count
    FROM public.companies c
    `;
    if (conditions.length > 0) {
      sql += `WHERE ${conditions.join(" AND ")}\n`;
    }
    sql += `ORDER BY c.${sortBy} ${sortOrder.toUpperCase()}\nLIMIT $${params.length + 1} OFFSET $${params.length + 2};`;
    params.push(limit, offset);
    const result = await query(sql, params);
    const total =
      result.rows.length > 0 ? Number(result.rows[0].total_count) : 0;
    const data = result.rows.map(({ total_count, ...row }) =>
      mapCompanyRow(row),
    );
    return { data, total };
  } catch (err) {
    logger.error(
      { err, limit, offset, filters, sortBy, sortOrder },
      "Error en getCompanies",
    );
    throw new Error("Error al obtener empresas desde la base de datos");
  }
};

export const searchCompanies = async ({
  query: searchQuery,
  limit = 10,
  offset = 0,
}) => {
  try {
    const searchPattern = `%${searchQuery}%`;
    const sql = `
SELECT ${companyColumns}, COUNT(*) OVER() AS total_count
FROM public.companies c
WHERE c.name ILIKE $1
 OR c.description ILIKE $1
 OR CONCAT(c.name, ' ', c.description) ILIKE $1
ORDER BY c.created_at DESC
LIMIT $2 OFFSET $3;
`;
    const result = await query(sql, [searchPattern, limit, offset]);
    const total =
      result.rows.length > 0 ? Number(result.rows[0].total_count) : 0;
    const data = result.rows.map(({ total_count, ...row }) =>
      mapCompanyRow(row),
    );
    return { data, total };
  } catch (err) {
    logger.error(
      { err, searchQuery, limit, offset },
      "Error en searchCompanies",
    );
    throw new Error("Error al buscar empresas en la base de datos");
  }
};

export const getCompanyById = async (id) => {
  try {
    const sql = `
SELECT ${companyColumns}
FROM public.companies c
WHERE c.id = $1;
`;
    const result = await query(sql, [id]);
    return result.rows[0] ? mapCompanyRow(result.rows[0]) : null;
  } catch (err) {
    logger.error({ err, id }, "Error en getCompanyById");
    throw new Error("Error al consultar la empresa por id");
  }
};

export const getCompanyByEmail = async (email) => {
  try {
    const sql = `SELECT id, email
    FROM public.companies
    WHERE email = $1;`;
    const result = await query(sql, [email]);
    return result.rows[0] || null;
  } catch (err) {
    logger.error({ err, email }, "Error en getCompanyByEmail");
    throw new Error("Error al consultar la empresa por su email");
  }
};

export const updateCompany = async (id, updateData) => {
  try {
    const fields = [];
    const values = [];
    let index = 1;
    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${index}`);
        values.push(value);
        index += 1;
      }
    });
    if (fields.length === 0) {
      return getCompanyById(id);
    }
    values.push(id);
    const sql = `
    UPDATE public.companies
    SET ${fields.join(", ")}, updated_at = NOW()
    WHERE id = $${index}
    RETURNING id;
    `;
    await query(sql, values);
    return getCompanyById(id);
  } catch (err) {
    logger.error({ err, id, updateData }, "Error en updateCompany");
    throw new Error("Error al actualizar la empresa");
  }
};
