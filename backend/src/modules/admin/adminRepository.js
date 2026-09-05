import { query } from "../../config/db.js";
import { logger } from "../../utils/logger.js";
import { AppError } from "../../utils/AppError.js";

// ─────────────────────────────────────────────────────────────────────────────
// ESTADÍSTICAS DEL DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna los KPIs principales del dashboard administrativo.
 */
export const getDashboardStats = async () => {
  try {
    const sql = `
      SELECT
        -- Usuarios
        (SELECT COUNT(*) FROM public.users) AS total_users,
        (SELECT COUNT(*) FROM public.users WHERE status = 'active') AS active_users,
        (SELECT COUNT(*) FROM public.users WHERE created_at >= NOW() - INTERVAL '30 days') AS new_users_30d,

        -- Empresas
        (SELECT COUNT(*) FROM public.companies) AS total_companies,
        (SELECT COUNT(*) FROM public.companies WHERE verification_status = 'verified') AS verified_companies,
        (SELECT COUNT(*) FROM public.companies WHERE verification_status = 'pending') AS pending_verifications,
        (SELECT COUNT(*) FROM public.companies WHERE verification_status = 'rejected') AS rejected_companies,

        -- Proveedores
        (SELECT COUNT(*) FROM public.suppliers) AS total_suppliers,
        (SELECT COUNT(*) FROM public.suppliers WHERE status = 'active') AS active_suppliers,

        -- Categorías
        (SELECT COUNT(*) FROM public.categories) AS total_categories,
        (SELECT COUNT(*) FROM public.categories WHERE status = 'active') AS active_categories,

        -- Productos
        (SELECT COUNT(*) FROM public.products) AS total_products,

        -- Registros por mes (últimos 6 meses)
        (
          SELECT json_agg(row_to_json(t))
          FROM (
            SELECT
              TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') AS month,
              COUNT(*) AS count
            FROM public.users
            WHERE created_at >= NOW() - INTERVAL '6 months'
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY DATE_TRUNC('month', created_at) ASC
          ) t
        ) AS users_by_month,

        -- Proveedores por estado
        (
          SELECT json_agg(row_to_json(t))
          FROM (
            SELECT status, COUNT(*) AS count
            FROM public.suppliers
            GROUP BY status
          ) t
        ) AS suppliers_by_status,

        -- Categorías con conteo de productos
        (
          SELECT json_agg(row_to_json(t))
          FROM (
            SELECT c.name, COUNT(p.id) AS product_count
            FROM public.categories c
            LEFT JOIN public.products p ON p.category_id = c.id
            WHERE c.parent_id IS NULL
            GROUP BY c.id, c.name
            ORDER BY product_count DESC
            LIMIT 8
          ) t
        ) AS categories_distribution
      ;
    `;
    const result = await query(sql, []);
    return result.rows[0];
  } catch (err) {
    logger.error({ err }, "Error en getDashboardStats");
    throw new Error("Error al obtener estadísticas del dashboard");
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GESTIÓN DE USUARIOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna listado paginado de todos los usuarios con filtros.
 */
export const getAllUsers = async ({
  limit = 10,
  offset = 0,
  status,
  role_id,
  search,
  sortBy = "created_at",
  sortOrder = "desc",
}) => {
  try {
    const params = [];
    const conditions = [];

    if (status) {
      params.push(status);
      conditions.push(`u.status = $${params.length}`);
    }
    if (role_id) {
      params.push(role_id);
      conditions.push(`u.role_id = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(
        `(u.first_name ILIKE $${params.length} OR u.last_name ILIKE $${params.length} OR u.email ILIKE $${params.length})`,
      );
    }

    const ALLOWED = new Set(["first_name", "last_name", "email", "status", "created_at", "updated_at", "last_login_at"]);
    const safeSort = ALLOWED.has(sortBy) ? sortBy : "created_at";
    const safeOrder = sortOrder === "asc" ? "ASC" : "DESC";

    let sql = `
      SELECT
        u.id, u.role_id, r.name AS role_name, u.first_name, u.last_name,
        u.email, u.phone, u.profile_picture_url, u.status,
        u.last_login_at, u.created_at, u.updated_at,
        COUNT(*) OVER() AS total_count
      FROM public.users u
      JOIN public.roles r ON r.id = u.role_id
    `;

    if (conditions.length > 0) {
      sql += `WHERE ${conditions.join(" AND ")}\n`;
    }

    params.push(limit, offset);
    sql += `ORDER BY u.${safeSort} ${safeOrder}\nLIMIT $${params.length - 1} OFFSET $${params.length};`;

    const result = await query(sql, params);
    const total = result.rows.length > 0 ? Number(result.rows[0].total_count) : 0;
    const data = result.rows.map(({ total_count, ...row }) => row);

    return { data, total };
  } catch (err) {
    logger.error({ err }, "Error en getAllUsers");
    throw new Error("Error al obtener usuarios");
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICACIONES DE EMPRESAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna empresas paginadas según su verification_status.
 */
export const getVerifications = async ({
  limit = 10,
  offset = 0,
  status = "pending",
  search,
}) => {
  try {
    const params = [];
    const conditions = [];

    if (status) {
      params.push(status);
      conditions.push(`c.verification_status = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      conditions.push(
        `(c.name ILIKE $${params.length} OR c.email ILIKE $${params.length})`,
      );
    }

    let sql = `
      SELECT
        c.id, c.name, c.description, c.tax_id, c.phone, c.email,
        c.address, c.state_province, c.city, c.logo_url,
        c.website_url, c.verification_status, c.created_at, c.updated_at,
        u.first_name AS owner_first_name,
        u.last_name AS owner_last_name,
        u.email AS owner_email,
        u.phone AS owner_phone,
        COUNT(*) OVER() AS total_count
      FROM public.companies c
      JOIN public.users u ON u.id = c.user_id
    `;

    if (conditions.length > 0) {
      sql += `WHERE ${conditions.join(" AND ")}\n`;
    }

    params.push(limit, offset);
    sql += `ORDER BY c.created_at DESC\nLIMIT $${params.length - 1} OFFSET $${params.length};`;

    const result = await query(sql, params);
    const total = result.rows.length > 0 ? Number(result.rows[0].total_count) : 0;
    const data = result.rows.map(({ total_count, ...row }) => row);

    return { data, total };
  } catch (err) {
    logger.error({ err }, "Error en getVerifications");
    throw new Error("Error al obtener solicitudes de verificación");
  }
};

/**
 * Actualiza el verification_status de una empresa.
 */
export const updateCompanyVerification = async (companyId, verificationStatus) => {
  try {
    const sql = `
      UPDATE public.companies
      SET verification_status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, name, verification_status, updated_at;
    `;
    const result = await query(sql, [verificationStatus, companyId]);
    return result.rows[0] || null;
  } catch (err) {
    logger.error({ err, companyId, verificationStatus }, "Error en updateCompanyVerification");
    throw new Error("Error al actualizar verificación de empresa");
  }
};

/**
 * Obtiene una empresa por ID para ver su detalle.
 */
export const getCompanyById = async (id) => {
  try {
    const sql = `
      SELECT
        c.*, u.first_name AS owner_first_name, u.last_name AS owner_last_name,
        u.email AS owner_email, u.phone AS owner_phone,
        s.id AS supplier_id, s.supplier_type, s.status AS supplier_status
      FROM public.companies c
      JOIN public.users u ON u.id = c.user_id
      LEFT JOIN public.suppliers s ON s.company_id = c.id
      WHERE c.id = $1;
    `;
    const result = await query(sql, [id]);
    return result.rows[0] || null;
  } catch (err) {
    logger.error({ err, id }, "Error en getCompanyById");
    throw new AppError("Error al consultar la empresa", 500);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GESTIÓN DE ADMINISTRADORES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna el ID del rol 'Admin'.
 */
export const getAdminRoleId = async () => {
  try {
    const result = await query(
      `SELECT id FROM public.roles WHERE LOWER(name) = 'admin' LIMIT 1;`,
      [],
    );
    return result.rows[0]?.id ?? null;
  } catch (err) {
    logger.error({ err }, "Error en getAdminRoleId");
    throw new Error("Error al buscar el rol Admin");
  }
};

/**
 * Retorna todos los usuarios con rol Admin.
 */
export const getAdministrators = async ({ limit = 50, offset = 0 }) => {
  try {
    const sql = `
      SELECT
        u.id, u.first_name, u.last_name, u.email, u.phone,
        u.profile_picture_url, u.status, u.last_login_at, u.created_at,
        COUNT(*) OVER() AS total_count
      FROM public.users u
      JOIN public.roles r ON r.id = u.role_id
      WHERE LOWER(r.name) = 'admin'
      ORDER BY u.created_at DESC
      LIMIT $1 OFFSET $2;
    `;
    const result = await query(sql, [limit, offset]);
    const total = result.rows.length > 0 ? Number(result.rows[0].total_count) : 0;
    const data = result.rows.map(({ total_count, ...row }) => row);
    return { data, total };
  } catch (err) {
    logger.error({ err }, "Error en getAdministrators");
    throw new Error("Error al obtener administradores");
  }
};
