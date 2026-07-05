import { query } from "../../config/db.js";
import { logger } from "../../utils/logger.js";

const categoryColumns = [
  "c.id",
  "c.parent_id",
  "c.parent_name",
  "c.name",
  "c.icon_url",
  "c.status",
  "c.created_at",
  "c.updated_at",
].join(", ");

const mapCategoryRow = (row) => ({
  id: row.id,
  parent_id: row.parent_id,
  parent_name: row.parent_name,
  name: row.name,
  icon_url: row.icon_url,
  status: row.status,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export const createCategory = async ({ parent_id, name, icon_url, status }) => {
  try {
    const sql = `
        INSERT INTO public.categories(
             parent_id, name, icon_url, status
        ) VALUES ($1, $2, $3, $4)
        RETURNING ${categoryColumns};
    `;
    const result = await query(sql, [parent_id, name, icon_url, status]);
    return mapCategoryRow(result.rows[0]);
  } catch (err) {
    (logger.error({ err, parent_id, id, name }),
      "Error al registrar la categoria");
    throw new Error("Error al registrar la categoria");
  }
};
