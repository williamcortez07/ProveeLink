import { query } from "../../config/db.js";
import { logger } from "../../utils/logger.js";
import { AppError } from "../../utils/AppError.js";

const productColumns = [
  "p.id",
  "p.supplier_id",
  "p.category_id",
  "c.name AS category_name",
  "p.name",
  "p.description",
  "p.price",
  "p.currency",
  "p.stock",
  "p.unit_of_measure",
  "p.brand",
  "p.model",
  "p.status",
  "p.created_at",
  "p.updated_at",
  "(SELECT pi.image_url FROM public.product_images pi WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC, pi.display_order ASC LIMIT 1) AS primary_image_url",
].join(", ");

const mapProductRow = (row) => ({
  id: row.id,
  supplier_id: row.supplier_id,
  category_id: row.category_id,
  category_name: row.category_name ?? null,
  name: row.name,
  description: row.description,
  price: parseFloat(row.price || 0),
  currency: row.currency,
  stock: parseFloat(row.stock || 0),
  unit_of_measure: row.unit_of_measure,
  brand: row.brand,
  model: row.model,
  status: row.status,
  primary_image_url: row.primary_image_url ?? null,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export const createProduct = async ({
  supplier_id,
  category_id,
  name,
  description,
  price,
  currency,
  stock,
  unit_of_measure,
  brand,
  model,
  status,
}) => {
  try {
    const sql = `
      INSERT INTO public.products (
        supplier_id, category_id, name, description, price, currency, stock, unit_of_measure, brand, model, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id;
    `;
    const result = await query(sql, [
      supplier_id,
      category_id,
      name,
      description,
      price,
      currency,
      stock,
      unit_of_measure,
      brand,
      model,
      status,
    ]);
    const newId = result.rows[0].id;
    return getProductById(newId);
  } catch (err) {
    if (err.code === "23503") {
      logger.warn(
        { supplier_id, category_id },
        "FK violation al registrar el producto",
      );
      throw new AppError(
        "El proveedor o la categoría especificada no existe",
        400,
      );
    }
    if (err instanceof AppError) throw err;
    logger.error(
      { err, supplier_id, category_id },
      "Error inesperado en createProduct",
    );
    throw new Error("Error al registrar el producto en la base de datos");
  }
};

export const getProducts = async ({
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
      conditions.push(`p.status = $${params.length}`);
    }
    if (filters.supplier_id) {
      params.push(filters.supplier_id);
      conditions.push(`p.supplier_id = $${params.length}`);
    }
    if (filters.category_id) {
      params.push(filters.category_id);
      conditions.push(`p.category_id = $${params.length}`);
    }

    let sql = `
      SELECT ${productColumns}, COUNT(*) OVER() AS total_count
      FROM public.products p
      JOIN public.suppliers s ON s.id = p.supplier_id
      JOIN public.categories c ON c.id = p.category_id
    `;
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(" AND ")}\n`;
    }
    sql += ` ORDER BY p.${sortBy} ${sortOrder.toUpperCase()}\nLIMIT $${params.length + 1} OFFSET $${params.length + 2};`;
    params.push(limit, offset);
    const result = await query(sql, params);
    const total =
      result.rows.length > 0 ? Number(result.rows[0].total_count) : 0;
    const data = result.rows.map(({ total_count, ...row }) =>
      mapProductRow(row),
    );
    return { data, total };
  } catch (err) {
    logger.error(
      { err, limit, offset, filters, sortBy, sortOrder },
      "Error en getProducts",
    );
    throw new Error("Error al obtener productos de la base de datos");
  }
};

export const searchProducts = async ({
  query: searchQuery,
  limit = 10,
  offset = 0,
}) => {
  try {
    const searchPattern = `%${searchQuery}%`;
    const sql = `
      SELECT ${productColumns}, COUNT(*) OVER() AS total_count
      FROM public.products p
      JOIN public.suppliers s ON s.id = p.supplier_id
      JOIN public.categories c ON c.id = p.category_id
      WHERE p.name ILIKE $1
         OR p.description ILIKE $1
         OR p.brand ILIKE $1
         OR CONCAT(p.name, ' ', p.description) ILIKE $1
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET $3;
    `;
    const result = await query(sql, [searchPattern, limit, offset]);
    const total =
      result.rows.length > 0 ? Number(result.rows[0].total_count) : 0;
    const data = result.rows.map(({ total_count, ...row }) =>
      mapProductRow(row),
    );
    return { data, total };
  } catch (err) {
    logger.error(
      { err, searchQuery, limit, offset },
      "Error en searchProducts",
    );
    throw new Error("Error al buscar productos en la base de datos");
  }
};

export const getProductById = async (id) => {
  try {
    const sql = `
      SELECT ${productColumns}
      FROM public.products p
      JOIN public.suppliers s ON s.id = p.supplier_id
      JOIN public.categories c ON c.id = p.category_id
      WHERE p.id = $1;
    `;
    const result = await query(sql, [id]);
    if (!result.rows[0]) return null;
    const product = mapProductRow(result.rows[0]);
    product.images = await getProductImages(id);
    return product;
  } catch (err) {
    logger.error({ err, id }, "Error en getProductById");
    throw new Error("Error al consultar el producto por id");
  }
};

export const updateProduct = async (id, updateData) => {
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
      return getProductById(id);
    }
    values.push(id);
    const sql = `
      UPDATE public.products
      SET ${fields.join(", ")}, updated_at = NOW()
      WHERE id = $${index}
      RETURNING id;
    `;
    await query(sql, values);
    return getProductById(id);
  } catch (err) {
    logger.error({ err, id, updateData }, "Error en updateProduct");
    throw new Error("Error al actualizar el producto");
  }
};

export const updateProductStatus = async (id, status) => {
  try {
    const sql = `
      UPDATE public.products
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id;
    `;
    await query(sql, [status, id]);
    return getProductById(id);
  } catch (err) {
    logger.error({ err, id, status }, "Error en updateProductStatus");
    throw new Error("Error al cambiar el estado del producto");
  }
};

export const deleteProduct = async (id) => {
  try {
    const sql = `DELETE FROM public.products WHERE id = $1 RETURNING id;`;
    const result = await query(sql, [id]);
    return result.rows.length > 0;
  } catch (err) {
    logger.error({ err, id }, "Error en deleteProduct");
    throw new Error("Error al eliminar el producto de la base de datos");
  }
};

// ── PRODUCT IMAGES ─────────────────────────────────────────────────────────

export const getProductImages = async (productId) => {
  try {
    const sql = `
      SELECT id, product_id, image_url, is_primary, display_order, created_at
      FROM public.product_images
      WHERE product_id = $1
      ORDER BY is_primary DESC, display_order ASC, created_at ASC;
    `;
    const result = await query(sql, [productId]);
    return result.rows;
  } catch (err) {
    logger.error({ err, productId }, "Error en getProductImages");
    return [];
  }
};

export const addProductImage = async ({ product_id, image_url, is_primary = false, display_order = 0 }) => {
  try {
    // Si se establece como primaria, desmarcar otras
    if (is_primary) {
      await query(`UPDATE public.product_images SET is_primary = FALSE WHERE product_id = $1;`, [product_id]);
    }

    const sql = `
      INSERT INTO public.product_images (product_id, image_url, is_primary, display_order)
      VALUES ($1, $2, $3, $4)
      RETURNING id, product_id, image_url, is_primary, display_order, created_at;
    `;
    const result = await query(sql, [product_id, image_url, is_primary, display_order]);
    return result.rows[0];
  } catch (err) {
    logger.error({ err, product_id, image_url }, "Error en addProductImage");
    throw new AppError("Error al asociar la imagen al producto", 500);
  }
};

export const deleteProductImage = async (imageId, productId) => {
  try {
    const sql = `
      DELETE FROM public.product_images
      WHERE id = $1 AND product_id = $2
      RETURNING id;
    `;
    const result = await query(sql, [imageId, productId]);
    return result.rows.length > 0;
  } catch (err) {
    logger.error({ err, imageId, productId }, "Error en deleteProductImage");
    throw new AppError("Error al eliminar la imagen del producto", 500);
  }
};
