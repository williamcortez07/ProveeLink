import { query } from "../../config/db.js";
import { logger } from "../../utils/logger.js";

/**
 * Llama al stored procedure sp_register_user_init.
 * Inserta el usuario (pending) y el registro verify_email en una sola transacción atómica.
 *
 * @param {{ role_id: string, email: string, password_hash: string, otp_hash: string, expires_minutes?: number }} params
 * @returns {Promise<string>} UUID del nuevo usuario
 */
export const spRegisterUserInit = async ({
  role_id,
  email,
  password_hash,
  otp_hash,
  expires_minutes = 15,
}) => {
  try {
    const sql = `SELECT sp_register_user_init($1, $2, $3, $4, $5) AS user_id;`;
    const result = await query(sql, [
      role_id,
      email,
      password_hash,
      otp_hash,
      expires_minutes,
    ]);
    return result.rows[0].user_id;
  } catch (err) {
    logger.error({ err, email }, "Error en spRegisterUserInit");
    throw err; // Re-lanzamos para que el service maneje los códigos PG
  }
};

/**
 * Busca el registro activo en verify_email para ese email
 * (used = false y no expirado).
 *
 * @param {string} email
 * @returns {Promise<object|null>}
 */
export const findActiveOtp = async (email) => {
  try {
    const sql = `
      SELECT id, user_id, code_otp, expires_in, failed_attempts
      FROM public.verify_email
      WHERE email = $1
        AND used = FALSE
        AND expires_in > NOW()
      ORDER BY created_on DESC
      LIMIT 1;
    `;
    const result = await query(sql, [email]);
    return result.rows[0] || null;
  } catch (err) {
    logger.error({ err, email }, "Error en findActiveOtp");
    throw new Error("Error al consultar el OTP activo");
  }
};

/**
 * Incrementa failed_attempts en 1 para un registro verify_email.
 *
 * @param {string} otpId UUID del registro verify_email
 */
export const incrementFailedAttempts = async (otpId) => {
  try {
    await query(
      `UPDATE public.verify_email SET failed_attempts = failed_attempts + 1 WHERE id = $1;`,
      [otpId],
    );
  } catch (err) {
    logger.warn({ err, otpId }, "No se pudo incrementar failed_attempts");
  }
};

/**
 * Marca el OTP como usado y activa la cuenta del usuario.
 * Ejecutado como transacción explícita para garantizar atomicidad.
 *
 * @param {string} otpId   UUID del registro verify_email
 * @param {string} userId  UUID del usuario a activar
 */
export const markOtpUsedAndActivateUser = async (otpId, userId) => {
  const client = await (await import("../../config/db.js")).pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE public.verify_email SET used = TRUE WHERE id = $1;`,
      [otpId],
    );

    await client.query(
      `UPDATE public.users SET status = 'active', updated_at = NOW() WHERE id = $1;`,
      [userId],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err, otpId, userId }, "Error en markOtpUsedAndActivateUser");
    throw new Error("Error al activar la cuenta del usuario");
  } finally {
    client.release();
  }
};

/**
 * Busca un usuario por email y devuelve id, status y role_id.
 *
 * @param {string} email
 * @returns {Promise<{ id: string, status: string, role_id: string, role_name: string }|null>}
 */
export const findUserByEmailForAuth = async (email) => {
  try {
    const sql = `
      SELECT u.id, u.status, u.role_id, r.name AS role_name
      FROM public.users u
      JOIN public.roles r ON r.id = u.role_id
      WHERE u.email = $1;
    `;
    const result = await query(sql, [email]);
    return result.rows[0] || null;
  } catch (err) {
    logger.error({ err, email }, "Error en findUserByEmailForAuth");
    throw new Error("Error al consultar el usuario por email");
  }
};

/**
 * Actualiza el registro verify_email con un nuevo OTP hasheado,
 * reseteando expires_in y failed_attempts.
 * Si no existe un registro para ese email, lo inserta.
 *
 * @param {{ email: string, user_id: string, otp_hash: string, expires_minutes?: number }} params
 */
export const upsertOtpForResend = async ({
  email,
  user_id,
  otp_hash,
  expires_minutes = 15,
}) => {
  try {
    const sql = `
      INSERT INTO public.verify_email (user_id, email, code_otp, verification_type, expires_in)
      VALUES ($1, $2, $3, 'registro', NOW() + ($4 || ' minutes')::INTERVAL)
      ON CONFLICT (email)
      DO UPDATE SET
        code_otp       = EXCLUDED.code_otp,
        expires_in     = EXCLUDED.expires_in,
        used           = FALSE,
        failed_attempts = 0,
        created_on     = NOW();
    `;
    await query(sql, [user_id, email, otp_hash, expires_minutes]);
  } catch (err) {
    logger.error({ err, email }, "Error en upsertOtpForResend");
    throw new Error("Error al actualizar el OTP");
  }
};

/**
 * Actualiza el perfil del usuario autenticado (first_name, last_name, phone).
 *
 * @param {string} userId UUID del usuario
 * @param {{ first_name: string, last_name: string, phone?: string }} data
 * @returns {Promise<object>} Usuario actualizado (columnas básicas sin hash)
 */
export const updateUserProfile = async (
  userId,
  { first_name, last_name, phone },
) => {
  try {
    const sql = `
      UPDATE public.users
      SET first_name  = $1,
          last_name   = $2,
          phone       = $3,
          updated_at  = NOW()
      WHERE id = $4
      RETURNING id, role_id, first_name, last_name, email, phone, profile_picture_url, status, updated_at;
    `;
    const result = await query(sql, [
      first_name,
      last_name,
      phone ?? null,
      userId,
    ]);
    return result.rows[0] || null;
  } catch (err) {
    logger.error({ err, userId }, "Error en updateUserProfile");
    throw new Error("Error al actualizar el perfil del usuario");
  }
};

/**
 * Busca el UUID de un rol por su nombre.
 * Usado internamente para asignar el rol por defecto al registrar usuarios.
 *
 * @param {string} name - Nombre exacto del rol (ej: 'usuario corriente')
 * @returns {Promise<string|null>} UUID del rol o null si no existe
 */
export const findRoleByName = async (name) => {
  try {
    const result = await query(
      `SELECT id FROM public.roles WHERE name = $1 LIMIT 1;`,
      [name],
    );
    return result.rows[0]?.id ?? null;
  } catch (err) {
    logger.error({ err, name }, "Error en findRoleByName");
    throw new Error("Error al buscar el rol por nombre");
  }
};
