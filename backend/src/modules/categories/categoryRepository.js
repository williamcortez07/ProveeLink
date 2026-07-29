import { query } from "../../config/db.js";
import { logger } from "../../utils/logger.js";

const categoryColumns = [
  "c.id",
  "c.parent_id",
  "c.name",
  "c.icon_url",
  "c.status",
  "c.created_at",
  "c.updated_at",
].join(", ");

const mapCategoryRow = (row) => ({
  id: row.id,
  parent_id: row.parent_id,
  name: row.name,
  icon_url: row.icon_url,
  status: row.status,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export const createCategory = async ({ parent_id, name, icon_url }) => {
  try {
    const sql = `
        INSERT INTO public.categories(
             parent_id, name, icon_url
        ) VALUES ($1, $2, $3)
        RETURNING id, parent_id, name, icon_url, status, created_at, updated_at;
    `;
    const result = await query(sql, [
      parent_id ?? null,
      name,
      icon_url ?? null,
    ]);
    return mapCategoryRow(result.rows[0]);
  } catch (err) {
    logger.error({ err, parent_id, name }, "Error al registrar la categoria");
    throw new Error("Error al registrar la categoria");
  }
};

export const getCategories = async ({
  limit = 10,
  offset = 0,
  filters = {},
  sortBy = "created_at",
  sortOrder = "desc",
} = {}) => {
  try {
    const params = [];
    const conditions = [];

    if (filters.status) {
      params.push(filters.status);
      conditions.push(`c.status = $${params.length}`);
    }
    if (filters.parent_id) {
      params.push(filters.parent_id);
      conditions.push(`c.parent_id = $${params.length}`);
    }
    if (filters.name) {
      params.push(`%${filters.name}%`);
      conditions.push(`c.name ILIKE $${params.length}`);
    }

    let sql = `
       SELECT ${categoryColumns}, COUNT(*) OVER() AS total_count
       FROM public.categories c
    `;
    if (conditions.length > 0) {
      sql += `WHERE ${conditions.join(" AND ")}\n`;
    }
    params.push(limit);
    params.push(offset);
    sql += `ORDER BY c.${sortBy} ${sortOrder.toUpperCase()}\nLIMIT $${params.length - 1} OFFSET $${params.length};`;

    const result = await query(sql, params);
    const total =
      result.rows.length > 0 ? Number(result.rows[0].total_count) : 0;
    const data = result.rows.map(({ total_count, ...row }) =>
      mapCategoryRow(row),
    );

    return { data, total };
  } catch (err) {
    logger.error(
      { err, limit, offset, filters, sortBy, sortOrder },
      "Error en getCategories",
    );
    throw new Error("Error al obtener las categorias");
  }
};

export const searchCategories = async ({
  query: searchQuery,
  limit = 10,
  offset = 0,
}) => {
  try {
    const searchPattern = `%${searchQuery}%`;
    const sql = `
    SELECT ${categoryColumns}, COUNT(*) OVER() AS total_count
    FROM public.categories c
    WHERE c.name ILIKE $1
    ORDER BY c.created_at DESC
    LIMIT $2 OFFSET $3;
    `;
    const result = await query(sql, [searchPattern, limit, offset]);
    const total =
      result.rows.length > 0 ? Number(result.rows[0].total_count) : 0;
    const data = result.rows.map(({ total_count, ...row }) =>
      mapCategoryRow(row),
    );
    return { data, total };
  } catch (err) {
    logger.error(
      { err, searchQuery, limit, offset },
      "Error en searchCategories",
    );
    throw new Error("Error al buscar categorias en la base de datos");
  }
};

export const getCategoryById = async (id) => {
  try {
    const sql = `
  SELECT ${categoryColumns}
  FROM public.categories c
  WHERE c.id = $1;
  `;
    const result = await query(sql, [id]);
    return result.rows[0] ? mapCategoryRow(result.rows[0]) : null;
  } catch (err) {
    logger.error({ err, id }, "Error en getCategoryById");
    throw new Error("Error al consultar la categoria por id");
  }
};

export const getCategoryByName = async (name) => {
  try {
    const sql = `
SELECT id, parent_id, name, icon_url, status, created_at, updated_at
FROM public.categories
WHERE name = $1;
`;
    const result = await query(sql, [name]);
    return result.rows[0] || null;
  } catch (err) {
    logger.error({ err, name }, "Error en getCategoryByName");
    throw new Error("Error al consultar una categoria por su nombre");
  }
};

export const updateCategory = async (id, updateData) => {
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
      return getCategoryById(id);
    }

    values.push(id);
    const sql = `
    UPDATE public.categories
    SET ${fields.join(", ")}, updated_at = NOW()
    WHERE id = $${index}
    RETURNING id;
    `;
    await query(sql, values);
    return getCategoryById(id);
  } catch (err) {
    logger.error({ err, id, updateData }, "Error en updateCategory");
    throw new Error("Error al actualizar la categoria");
  }
};
