import { query } from "../../config/db.js";
import { logger } from "../../utils/logger.js";
import { AppError } from "../../utils/AppError.js";

const commentColumns = [
  "c.id",
  "c.user_id",
  "u.first_name AS user_first_name",
  "u.last_name AS user_last_name",
  "u.profile_picture_url AS user_avatar",
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
  user: {
    first_name: row.user_first_name,
    last_name: row.user_last_name,
    profile_picture_url: row.user_avatar,
  },
  supplier_id: row.supplier_id,
  product_id: row.product_id,
  content: row.content,
  status: row.status,
  created_at: row.created_at,
  updated_at: row.updated_at,
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
      INSERT INTO public.comments (user_id, supplier_id, product_id, content, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id;
    `;
    const result = await query(sql, [
      user_id,
      supplier_id ?? null,
      product_id ?? null,
      content,
      status,
    ]);
    const newId = result.rows[0].id;
    return getCommentById(newId);
  } catch (err) {
    if (err.code === "23503") {
      const detail = err.detail || "";
      if (detail.includes("user_id")) {
        logger.warn(
          { user_id },
          "FK violation: usuario no existe al crear comentario",
        );
        throw new AppError(
          "El usuario especificado no existe en el sistema",
          400,
        );
      }
      if (detail.includes("supplier_id")) {
        logger.warn(
          { supplier_id },
          "FK violation: proveedor no existe al crear comentario",
        );
        throw new AppError(
          "El proveedor especificado no existe en el sistema",
          400,
        );
      }
      if (detail.includes("product_id")) {
        logger.warn(
          { product_id },
          "FK violation: producto no existe al crear comentario",
        );
        throw new AppError(
          "El producto especificado no existe en el sistema",
          400,
        );
      }
      throw new AppError(
        "El destinatario del comentario no existe en el sistema",
        400,
      );
    }
    if (err.code === "23514") {
      logger.warn(
        { supplier_id, product_id },
        "CHECK violation al crear comentario",
      );
      throw new AppError(
        "El comentario debe dirigirse exclusivamente a un proveedor o a un producto",
        400,
      );
    }
    if (err instanceof AppError) throw err;
    logger.error(
      { err, user_id, supplier_id, product_id },
      "Error inesperado en createComment",
    );
    throw new Error("Error al registrar el comentario en la base de datos");
  }
};

export const getComments = async ({
  limit = 10,
  offset = 0,
  filters = {},
  sortBy = "created_at",
  sortOrder = "desc",
}) => {
  try {
    const params = [];
    const conditions = [];

    if (filters.supplier_id) {
      params.push(filters.supplier_id);
      conditions.push(`c.supplier_id = $${params.length}`);
    }

    if (filters.product_id) {
      params.push(filters.product_id);
      conditions.push(`c.product_id = $${params.length}`);
    }

    if (filters.status) {
      params.push(filters.status);
      conditions.push(`c.status = $${params.length}`);
    }

    if (filters.user_id) {
      params.push(filters.user_id);
      conditions.push(`c.user_id = $${params.length}`);
    }

    let sql = `
      SELECT ${commentColumns}, COUNT(*) OVER() AS total_count
      FROM public.comments c
      JOIN public.users u ON u.id = c.user_id
    `;

    if (conditions.length > 0) {
      sql += `WHERE ${conditions.join(" AND ")}\n`;
    }

    sql += `ORDER BY c.${sortBy} ${sortOrder.toUpperCase()}\nLIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(sql, params);
    const total =
      result.rows.length > 0 ? Number(result.rows[0].total_count) : 0;
    const data = result.rows.map(({ total_count, ...row }) =>
      mapCommentRow(row),
    );

    return { data, total };
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error(
      { err, limit, offset, filters, sortBy, sortOrder },
      "Error en getComments",
    );
    throw new Error("Error al obtener los comentarios desde la base de datos");
  }
};

export const getCommentById = async (id) => {
  try {
    const sql = `
      SELECT ${commentColumns}
      FROM public.comments c
      JOIN public.users u ON u.id = c.user_id
      WHERE c.id = $1;
    `;
    const result = await query(sql, [id]);
    return result.rows[0] ? mapCommentRow(result.rows[0]) : null;
  } catch (err) {
    logger.error({ err, id }, "Error en getCommentById");
    throw new AppError("Error al consultar el comentario", 500);
  }
};

export const updateComment = async (id, content) => {
  try {
    const sql = `
      UPDATE public.comments
      SET content = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id;
    `;
    const result = await query(sql, [content, id]);
    if (!result.rows[0]) return null;
    return getCommentById(id);
  } catch (err) {
    logger.error({ err, id }, "Error en updateComment");
    throw new AppError("Error al actualizar el comentario", 500);
  }
};

export const deleteComment = async (id) => {
  try {
    const sql = `
      DELETE FROM public.comments
      WHERE id = $1
      RETURNING id;
    `;
    const result = await query(sql, [id]);
    return result.rows.length > 0;
  } catch (err) {
    logger.error({ err, id }, "Error en deleteComment");
    throw new AppError("Error al eliminar el comentario", 500);
  }
};

export const updateCommentStatus = async (id, status) => {
  try {
    const sql = `
      UPDATE public.comments
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id;
    `;
    const result = await query(sql, [status, id]);
    if (!result.rows[0]) return null;
    return getCommentById(id);
  } catch (err) {
    if (err.code === "23514") {
      throw new AppError(
        "El estado proporcionado no es válido. Use: visible, hidden o under_review",
        400,
      );
    }
    logger.error({ err, id, status }, "Error en updateCommentStatus");
    throw new AppError("Error al actualizar el estado del comentario", 500);
  }
};
