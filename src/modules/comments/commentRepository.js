import { query } from "../../config/db.js";
import { logger } from "../../utils/logger.js";

const commentColumns = [
  "c.id",
  "c.user_id",
  "c.supplier_id",
  "c.product_id",
  "c.content",
  "c.status",
  "c.created_at",
  "c.updated_at",
].join(", ");

const mapCommentRow = (row) => ({
  id: row.id,
  user_id: row.user_id,
  supplier_id: row.suplier_id,
  product_id: row.product_id,
  content: row.content,
  status: row.status,
  created_at: row.created_at,
  update_at: row.update_at,
});

export const createComment = async ({
  user_id,
  supplier_id,
  product_id,
  content,
  status,
}) => {
  try {
    const sql = `
        INSERT INTO public.comments(
            user_id, supplier_id, product_id, content, status
        )VALUES($1, $2, $3, $4, $5)
        RETURNING id, user_id, supplier_id, product_id, content, status, created_at, updated_at;
    `;
    const result = await query(sql, [
      user_id,
      supplier_id,
      product_id,
      content,
      status,
    ]);
    return result.rows[0];
  } catch (err) {
    logger.error(
      { err, supplier_id, product_id, content },
      "Error en createComment",
    );
    throw new Error("Error al registrar el comentario");
  }
};

export const getComments = async (
  limit = 10,
  offset = 0,
  contentFilter = null,
) => {
  const lim = Number(limit) || 10;
  const off = Number(offset) || 0;
  let sql = `
    SELECT id, user_id, supplier_id, product_id, content, status, created_at, updated_at,
    COUNT(*) OVER() AS total_count
    FROM public.comments

    `;
  const params = [];
};
