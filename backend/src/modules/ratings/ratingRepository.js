import { query } from "../../config/db.js";
import { logger } from "../../utils/logger.js";
import { AppError } from "../../utils/AppError.js";

const ratingColumns = [
  "r.id",
  "r.user_id",
  "u.first_name AS user_first_name",
  "u.last_name AS user_last_name",
  "u.profile_picture_url AS user_avatar",
  "r.supplier_id",
  "r.product_id",
  "r.score",
  "r.created_at",
].join(", ");

const mapRatingRow = (row) => ({
  id: row.id,
  user_id: row.user_id,
  user: {
    first_name: row.user_first_name,
    last_name: row.user_last_name,
    profile_picture_url: row.user_avatar,
  },
  supplier_id: row.supplier_id,
  product_id: row.product_id,
  score: row.score,
  created_at: row.created_at,
});

export const upsertRating = async ({
  user_id,
  supplier_id,
  product_id,
  score,
}) => {
  try {
    let sql;
    let params;

    if (supplier_id) {
      sql = `
        INSERT INTO public.ratings (user_id, supplier_id, product_id, score)
        VALUES ($1, $2, NULL, $3)
        ON CONFLICT ON CONSTRAINT uq_user_supplier_rating
        DO UPDATE SET score = EXCLUDED.score
        RETURNING id, (xmax = 0) AS is_new;
      `;
      params = [user_id, supplier_id, score];
    } else {
      sql = `
        INSERT INTO public.ratings (user_id, supplier_id, product_id, score)
        VALUES ($1, NULL, $2, $3)
        ON CONFLICT ON CONSTRAINT uq_user_product_rating
        DO UPDATE SET score = EXCLUDED.score
        RETURNING id, (xmax = 0) AS is_new;
      `;
      params = [user_id, product_id, score];
    }

    const result = await query(sql, params);
    const { id, is_new } = result.rows[0];
    const rating = await getRatingById(id);
    return { rating, created: is_new };
  } catch (err) {
    if (err.code === "23503") {
      const detail = err.detail || "";
      if (detail.includes("user_id")) {
        throw new AppError(
          "El usuario especificado no existe en el sistema",
          400,
        );
      }
      if (detail.includes("supplier_id")) {
        throw new AppError(
          "El proveedor especificado no existe en el sistema",
          400,
        );
      }
      if (detail.includes("product_id")) {
        throw new AppError(
          "El producto especificado no existe en el sistema",
          400,
        );
      }
      throw new AppError(
        "El destinatario del rating no existe en el sistema",
        400,
      );
    }
    if (err.code === "23514") {
      throw new AppError(
        "El rating debe dirigirse exclusivamente a un proveedor o a un producto",
        400,
      );
    }
    if (err instanceof AppError) throw err;
    logger.error(
      { err, user_id, supplier_id, product_id },
      "Error inesperado en upsertRating",
    );
    throw new Error("Error al registrar el rating en la base de datos");
  }
};

/**
 * Retorna un listado paginado de ratings con filtros opcionales.
 */
export const getRatings = async ({
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
      conditions.push(`r.supplier_id = $${params.length}`);
    }

    if (filters.product_id) {
      params.push(filters.product_id);
      conditions.push(`r.product_id = $${params.length}`);
    }

    if (filters.user_id) {
      params.push(filters.user_id);
      conditions.push(`r.user_id = $${params.length}`);
    }

    let sql = `
      SELECT ${ratingColumns}, COUNT(*) OVER() AS total_count
      FROM public.ratings r
      JOIN public.users u ON u.id = r.user_id
    `;

    if (conditions.length > 0) {
      sql += `WHERE ${conditions.join(" AND ")}\n`;
    }

    sql += `ORDER BY r.${sortBy} ${sortOrder.toUpperCase()}\nLIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(sql, params);
    const total =
      result.rows.length > 0 ? Number(result.rows[0].total_count) : 0;
    const data = result.rows.map(({ total_count, ...row }) =>
      mapRatingRow(row),
    );

    return { data, total };
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error(
      { err, limit, offset, filters, sortBy, sortOrder },
      "Error en getRatings",
    );
    throw new Error("Error al obtener los ratings desde la base de datos");
  }
};

export const getRatingById = async (id) => {
  try {
    const sql = `
      SELECT ${ratingColumns}
      FROM public.ratings r
      JOIN public.users u ON u.id = r.user_id
      WHERE r.id = $1;
    `;
    const result = await query(sql, [id]);
    return result.rows[0] ? mapRatingRow(result.rows[0]) : null;
  } catch (err) {
    logger.error({ err, id }, "Error en getRatingById");
    throw new AppError("Error al consultar el rating", 500);
  }
};

export const updateRating = async (id, score) => {
  try {
    const sql = `
      UPDATE public.ratings
      SET score = $1
      WHERE id = $2
      RETURNING id;
    `;
    const result = await query(sql, [score, id]);
    if (!result.rows[0]) return null;
    return getRatingById(id);
  } catch (err) {
    if (err.code === "23514") {
      throw new AppError("El score debe estar entre 1 y 5", 400);
    }
    logger.error({ err, id, score }, "Error en updateRating");
    throw new AppError("Error al actualizar el rating", 500);
  }
};

export const deleteRating = async (id) => {
  try {
    const sql = `
      DELETE FROM public.ratings
      WHERE id = $1
      RETURNING id;
    `;
    const result = await query(sql, [id]);
    return result.rows.length > 0;
  } catch (err) {
    logger.error({ err, id }, "Error en deleteRating");
    throw new AppError("Error al eliminar el rating", 500);
  }
};

/**
 * Retorna estadísticas agregadas de ratings para un proveedor o producto:
 * promedio, total y distribución por estrellas (1–5).
 *
 * @param {{ supplier_id?: string, product_id?: string }} filter
 */
export const getRatingStats = async ({ supplier_id, product_id }) => {
  try {
    let whereClause;
    let params;

    if (supplier_id) {
      whereClause = "r.supplier_id = $1";
      params = [supplier_id];
    } else {
      whereClause = "r.product_id = $1";
      params = [product_id];
    }

    const sql = `
      SELECT
        ROUND(AVG(r.score)::numeric, 2)               AS average,
        COUNT(*)                                       AS total,
        COUNT(*) FILTER (WHERE r.score = 5)            AS score_5,
        COUNT(*) FILTER (WHERE r.score = 4)            AS score_4,
        COUNT(*) FILTER (WHERE r.score = 3)            AS score_3,
        COUNT(*) FILTER (WHERE r.score = 2)            AS score_2,
        COUNT(*) FILTER (WHERE r.score = 1)            AS score_1
      FROM public.ratings r
      WHERE ${whereClause};
    `;

    const result = await query(sql, params);
    const row = result.rows[0];

    return {
      average: row.total > 0 ? parseFloat(row.average) : null,
      total: Number(row.total),
      distribution: {
        5: Number(row.score_5),
        4: Number(row.score_4),
        3: Number(row.score_3),
        2: Number(row.score_2),
        1: Number(row.score_1),
      },
    };
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error({ err, supplier_id, product_id }, "Error en getRatingStats");
    throw new Error("Error al calcular las estadísticas de ratings");
  }
};
