import { query } from '../../../config/db.js';
import { logger } from '../../../utils/logger.js';

export const createRole = async (name, description = null) => {
  try {
    const sql = `
      INSERT INTO public.roles (name, description)
      VALUES ($1, $2)
      RETURNING id, name, description, created_at, updated_at;
    `;
    const result = await query(sql, [name, description]);
    return result.rows[0];
  } catch (err) {
    logger.error({ err, name }, 'Error en createRole');
    throw new Error('Error al crear el rol en la base de datos');
  }
};


export const getRoles = async (limit = 10, offset = 0, nameFilter = null) => {
  try {
    const lim = Number(limit) || 10;
    const off = Number(offset) || 0;

    let sql = `
      SELECT id, name, description, created_at, updated_at,
             COUNT(*) OVER() AS total_count
      FROM public.roles
    `;
    const params = [];

    if (nameFilter) {
      params.push(`%${nameFilter}%`);
      sql += ` WHERE name ILIKE $${params.length}`;
    }

    params.push(lim);
    sql += ` ORDER BY created_at DESC LIMIT $${params.length}`;

    params.push(off);
    sql += ` OFFSET $${params.length};`;

    const result = await query(sql, params);

    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    const data = result.rows.map(({ total_count, ...role }) => role);

    return { data, total };
  } catch (err) {
    logger.error({ err, limit, offset, nameFilter }, 'Error en getRoles');
    throw new Error('Error al obtener roles desde la base de datos');
  }
};

export const getRoleById = async (id) => {
  try {
    const sql = `
      SELECT id, name, description, created_at, updated_at
      FROM public.roles
      WHERE id = $1;
    `;
    const result = await query(sql, [id]);
    return result.rows[0] || null;
  } catch (err) {
    logger.error({ err, id }, 'Error en getRoleById');
    throw new Error('Error al consultar rol por id');
  }
};


export const getRoleByName = async (name) => {
  try {
    const sql = `
      SELECT id, name, description, created_at, updated_at
      FROM public.roles
      WHERE name = $1;
    `;
    const result = await query(sql, [name]);
    return result.rows[0] || null;
  } catch (err) {
    logger.error({ err, name }, 'Error en getRoleByName');
    throw new Error('Error al consultar rol por nombre');
  }
};

export const updateRole = async (id, updateData) => {
  try {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (updateData.name !== undefined) {
      fields.push(`name = $${paramIndex}`);
      values.push(updateData.name);
      paramIndex++;
    }

    if (updateData.description !== undefined) {
      fields.push(`description = $${paramIndex}`);
      values.push(updateData.description);
      paramIndex++;
    }

    if (fields.length === 0) return null;

    fields.push(`updated_at = NOW()`);

    values.push(id);
    const sql = `
      UPDATE public.roles
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, name, description, created_at, updated_at;
    `;

    const result = await query(sql, values);
    return result.rows[0] || null;
  } catch (err) {
    logger.error({ err, id, updateData }, 'Error en updateRole');
    throw new Error('Error al actualizar el rol');
  }
};
