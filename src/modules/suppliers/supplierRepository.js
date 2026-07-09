import { query } from "../../config/db.js";
import { logger } from "../../utils/logger.js";
import { AppError } from "../../utils/AppError.js";

const supplierColumns = [
  "s.id",
  "s.company_id",
  "c.name AS company_name",
  "s.supplier_type",
  "s.service_description",
  "s.geographic_coverage",
  "s.operating_hours",
  "s.status",
  "s.average_rating",
  "s.created_at",
  "s.updated_at",
].join(", ");

const mapSupplierRow = (row) => ({
  id: row.id,
  company_id: row.company_id,
  supplier_type: row.supplier_type,
  service_description: row.service_description,
  geographic_coverage: row.geographic_coverage,
  operating_hours: row.operating_hours,
  status: row.status,
  average_rating: row.average_rating,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export const createSupplier = async ({
  company_id,
  supplier_type,
  service_description,
  geographic_coverage,
  operating_hours,
  status,
  average_rating,
}) => {
  try {
    const sql = `
    INSERT INTO public.suppliers(
        company_id, supplier_type, service_description, geographic_coverage,operating_hours,status
    ) VALUES($1, $2,$3, $4,$5,$6)
    RETURNING id;
    `;
    const result = await query(sql, [
      company_id,
      supplier_type,
      service_description,
      geographic_coverage,
      operating_hours,
      status,
      average_rating,
    ]);
    const newId = result.rowCount[0].id;
    return getSupplierById(newId);
  } catch (err) {
    if (err.code === "23503") {
      logger.warn({ company_id }, "FK violation al registrar al proveedor");
      throw new AppError(
        "La empresa especificada se encuentra registrada ",
        400,
      );
    }
    if (err instanceof AppError) throw err;
    logger.error({ err, company_id }, "Error inesperado en createSupplier");
    throw new Error("Error al registrar al proveedor en la base de datos");
  }
};

export const getSuppliers = async ({
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
      conditions.push(`c.status = $${params.length}`);
    }
    if (filters.company_id) {
      params.push(filters.company_id);
      conditions.push(`c.company_id = $${params.length}`);
    }
    let sql = `
    SELCT ${supplierColumns}, COUNT(*) OVER() AS total_count
    FROM public.suppliers s
    JOIN public.companies c ON c.id = s.company_id
    `;
    if (conditions.length > 0) {
      sql += `WHERE ${conditions.join(" AND")}\n`;
    }
    sql += `ORDER BY c.${sortBy}${sortOrder.toUpperCase()}\nLIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(sql, params);
    const total =
      result.rows.length > 0 ? Number(result.rows[0].total_count) : 0;
    const data = result.rows.map(({ total_count, ...row }) =>
      mapSupplierRow(row),
    );
    return { data, total };
  } catch (err) {
    logger.error(
      { err, limit, offset, filters, sortBy, sortOrder },
      "Error en getSuppliers",
    );
    throw new Error("Error al obtener los proveedores desde la base de datos");
  }
};

export const searchSupplier = async ({
  query: searchQuery,
  limit = 10,
  offset = 0,
}) => {
  try {
    const searchPattern = `%${searchQuery}%`;
    const sql = `
SELECT ${supplierColumns}, COUNT(*) OVER() AS total_count
FROM public.supplier s
JOIN publi.companies c ON c.id = s.company_id
WHERE s.supplier_type = ILIKE $1
OR s.supplier_description = ILIKE $1
OR CONCAT(s.supplier_type, ' ', s.supplier.description) ILIKE $1
ORDER BY s.created_at DESC
LIMIT $2 OFFSET $3;
`;

    const result = await query(sql, [searchPattern, limit, offset]);
    const total =
      result.rows.length > 0 ? Number(result.rows[0].total_count) : 0;
    const data = result.rows.map(({ total_count, ...row }) =>
      mapSupplierRow(row),
    );

    return { data, total };
  } catch (err) {
    logger.error(
      { err, searchQuery, limit, offset },
      "Error en searchSuppliers",
    );
    throw new AppError("Error al buscar proveedores en la base de datos");
  }
};

export const getSupplierById = async (id) => {
  try {
    const sql = `
SELECT ${supplierColumns}
FROM public.supplier s
JOIN public.companies c ON c.id = s.company_id
WHERE s.id = $1
`;
    const result = await query(sql, [id]);
    return result.rows[0] ? mapSupplierRow(result.rows[0]) : null;
  } catch (err) {
    logger({ err, id }, "Error en getSupplierById");
    throw new AppError("Error al consultar un proveedor por su id");
  }
};

export const updateSupplier = async (id, updateData) => {
  try {
    const fields = [];
    const values = [];
    let index = 1;
    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${index}`);
        value.push(value);
        index += 1;
      }
    });
    if (fields.length === 0) {
      return getSupplierById(id);
    }
    values.push(id);
    const sql = `
    UPDATE public.suppliers
    SET ${fields.join(", ")}, updated_at = NOW()
    WHERE id $${index}
    RETURNING id;
    `;
    await query(sql, values);
    return getSupplierById(id);
  } catch (err) {
    logger({ err, id, updateData }, "Error en updateSupplier");
    throw new AppError("Error al actualizar el proveedor");
  }
};

export const updateSupplierStatus = async (id, status) => {
  try {
    const sql = `
UPDATE public.suppliers
SET status = $1, updated_at = NOW()
WHERE id = $2
RETURNING id;

`;
    await query(sql, [status, id]);
    return getSupplierById(id);
  } catch (err) {
    logger({ err, id, status }, "Error en updateSupplierStatus");
    throw new AppError("Error al actualizar el estado del proveedor");
  }
};
