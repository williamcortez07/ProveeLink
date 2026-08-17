import { query } from "../../config/db.js";
import { logger } from "../../utils/logger.js";
import { AppError } from "../../utils/AppError.js";

const userColumns = [
  "u.id",
  "u.role_id",
  "r.name AS role_name",
  "u.first_name",
  "u.last_name",
  "u.email",
  "u.phone",
  "u.profile_picture_url",
  "u.status",
  "u.last_login_at",
  "u.created_at",
  "u.updated_at",
].join(", ");

const mapUserRow = (row) => ({
  id: row.id,
  role_id: row.role_id,
  role_name: row.role_name,
  first_name: row.first_name,
  last_name: row.last_name,
  email: row.email,
  phone: row.phone,
  profile_picture_url: row.profile_picture_url,
  status: row.status,
  last_login_at: row.last_login_at,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export const createUser = async ({
  role_id,
  first_name,
  last_name,
  email,
  phone = null,
  password_hash,
  profile_picture_url = null,
  status,
}) => {
  try {
    const sql = `
      INSERT INTO public.users (
        role_id, first_name, last_name, email, phone, password_hash, profile_picture_url, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id;
    `;

    const result = await query(sql, [
      role_id,
      first_name,
      last_name,
      email,
      phone,
      password_hash,
      profile_picture_url,
      status,
    ]);

    const newId = result.rows[0].id;
    return getUserById(newId);
  } catch (err) {
    if (err.code === "23505") {
      logger.warn({ email }, "Intento de registro con email duplicado");
      throw new AppError("El correo electrónico ya está registrado", 409);
    }
    if (err.code === "23503") {
      logger.warn({ role_id }, "FK violation al crear usuario");
      throw new AppError("El role especificado no existe", 400);
    }
    if (err instanceof AppError) throw err;
    logger.error({ err, role_id, email }, "Error inesperado en createUser");
    throw new Error("Error al registrar al usuario en la base de datos");
  }
};

export const getUsers = async ({
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
      conditions.push(`u.status = $${params.length}`);
    }

    if (filters.role_id) {
      params.push(filters.role_id);
      conditions.push(`u.role_id = $${params.length}`);
    }

    let sql = `
      SELECT ${userColumns}, COUNT(*) OVER() AS total_count
      FROM public.users u
      JOIN public.roles r ON r.id = u.role_id
    `;

    if (conditions.length > 0) {
      sql += `WHERE ${conditions.join(" AND ")}\n`;
    }

    sql += `ORDER BY u.${sortBy} ${sortOrder.toUpperCase()}\nLIMIT $${params.length + 1} OFFSET $${params.length + 2};`;
    params.push(limit, offset);

    const result = await query(sql, params);
    const total =
      result.rows.length > 0 ? Number(result.rows[0].total_count) : 0;
    const data = result.rows.map(({ total_count, ...row }) => mapUserRow(row));

    return { data, total };
  } catch (err) {
    logger.error(
      { err, limit, offset, filters, sortBy, sortOrder },
      "Error en getUsers",
    );
    throw new Error("Error al obtener usuarios desde la base de datos");
  }
};

export const searchUsers = async ({
  query: searchQuery,
  limit = 10,
  offset = 0,
}) => {
  try {
    const searchPattern = `%${searchQuery}%`;
    const sql = `
      SELECT ${userColumns}, COUNT(*) OVER() AS total_count
      FROM public.users u
      JOIN public.roles r ON r.id = u.role_id
      WHERE u.first_name ILIKE $1
         OR u.last_name ILIKE $1
         OR CONCAT(u.first_name, ' ', u.last_name) ILIKE $1
      ORDER BY u.created_at DESC
      LIMIT $2 OFFSET $3;
    `;

    const result = await query(sql, [searchPattern, limit, offset]);
    const total =
      result.rows.length > 0 ? Number(result.rows[0].total_count) : 0;
    const data = result.rows.map(({ total_count, ...row }) => mapUserRow(row));

    return { data, total };
  } catch (err) {
    logger.error({ err, searchQuery, limit, offset }, "Error en searchUsers");
    throw new Error("Error al buscar usuarios en la base de datos");
  }
};

export const getUserById = async (id) => {
  try {
    const sql = `
      SELECT ${userColumns}
      FROM public.users u
      JOIN public.roles r ON r.id = u.role_id
      WHERE u.id = $1;
    `;
    const result = await query(sql, [id]);
    return result.rows[0] ? mapUserRow(result.rows[0]) : null;
  } catch (err) {
    logger.error({ err, id }, "Error en getUserById");
    throw new Error("Error al consultar al usuario por id");
  }
};

export const getUserByEmail = async (email) => {
  try {
    const sql = `
      SELECT id, email
      FROM public.users
      WHERE email = $1;
    `;
    const result = await query(sql, [email]);
    return result.rows[0] || null;
  } catch (err) {
    logger.error({ err, email }, "Error en getUserByEmail");
    throw new Error("Error al consultar el usuario por email");
  }
};

/**
 * Obtiene los datos de autenticación de un usuario por email.
 * Incluye password_hash y role_name, necesarios para el login.
 * No usar este método en respuestas de la API.
 */
export const getUserForAuth = async (email) => {
  try {
    const sql = `
      SELECT u.id, u.email, u.password_hash, u.status, u.role_id, r.name AS role_name
      FROM public.users u
      JOIN public.roles r ON r.id = u.role_id
      WHERE u.email = $1;
    `;
    const result = await query(sql, [email]);
    return result.rows[0] || null;
  } catch (err) {
    logger.error({ err, email }, "Error en getUserForAuth");
    throw new Error("Error al consultar credenciales del usuario");
  }
};

/**
 * Actualiza la fecha de último login del usuario.
 */
export const updateLastLogin = async (id) => {
  try {
    await query(
      `UPDATE public.users SET last_login_at = NOW() WHERE id = $1;`,
      [id],
    );
  } catch (err) {
    logger.warn({ err, id }, "No se pudo actualizar last_login_at");
    // No propagamos el error — es una operación no crítica
  }
};

/**
 * Obtiene los datos de autenticación por ID de usuario (para refresh token).
 */
export const getUserForAuthById = async (id) => {
  try {
    const sql = `
      SELECT u.id, u.email, u.password_hash, u.status, u.role_id, r.name AS role_name
      FROM public.users u
      JOIN public.roles r ON r.id = u.role_id
      WHERE u.id = $1;
    `;
    const result = await query(sql, [id]);
    return result.rows[0] || null;
  } catch (err) {
    logger.error({ err, id }, "Error en getUserForAuthById");
    throw new Error("Error al consultar credenciales del usuario");
  }
};

export const updateUser = async (id, updateData) => {
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
      return getUserById(id);
    }

    values.push(id);
    const sql = `
      UPDATE public.users
      SET ${fields.join(", ")}, updated_at = NOW()
      WHERE id = $${index}
      RETURNING id;
    `;
    await query(sql, values);
    return getUserById(id);
  } catch (err) {
    logger.error({ err, id, updateData }, "Error en updateUser");
    throw new Error("Error al actualizar el usuario");
  }
};

export const updateUserStatus = async (id, status) => {
  try {
    const sql = `
      UPDATE public.users
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id;
    `;
    await query(sql, [status, id]);
    return getUserById(id);
  } catch (err) {
    logger.error({ err, id, status }, "Error en updateUserStatus");
    throw new Error("Error al actualizar el estado del usuario");
  }
};

/**
 *
 * @param {string} id - UUID del usuario
 * @param {string} roleId - UUID del nuevo rol
 * @returns {Promise<object>} Usuario actualizado con role_name incluido
 */
export const updateUserRole = async (id, roleId) => {
  try {
    const sql = `
      UPDATE public.users
      SET role_id = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id;
    `;
    await query(sql, [roleId, id]);
    return getUserById(id);
  } catch (err) {
    if (err.code === "23503") {
      logger.warn({ id, roleId }, "FK violation al actualizar rol de usuario");
      throw new AppError("El rol especificado no existe", 400);
    }
    logger.error({ err, id, roleId }, "Error en updateUserRole");
    throw new Error("Error al actualizar el rol del usuario");
  }
};
