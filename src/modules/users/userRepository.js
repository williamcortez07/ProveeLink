import { email } from 'zod/v4';
import {query} from '../../config/db.js';
import{logger} from '../../utils/logger.js';
export const createUser = async (first_name, last_name, email, phone,password_hash,profile_picture_url, status,)=>{
try{
const sql =  `
INSERT INTO public.users(first_name,last_name,email,phone,password_hash,profile_picture_url,status)
VALUES($1, $2, $3, $4,$5,$6)
RETURNING id, first_name, last_name, email, phone, password_hash,profile_picture_url, status, last_login_at,created_at, updated_at;
`;
const result = await query(sql, [first_name, last_name, email, phone,password_hash,profile_picture_url, status]);
return result.rows[0];

}catch(err){
logger.error({err, first_name, last_name}, 'Error en createUser');
throw new Error('Error al registrar al usuario en la base de datos');
}
};


export const getUsers = async (limit = 10, offset = 0, nameFilter = null) =>{
try{

    const lim = Number(limit) || 10;
    const off = Number(offset) || 0;
    let sql = `
      SELECT id, first_name, last_name, email, phone, password_hash,profile_picture_url, status, last_login_at,created_at, updated_at,
      COUNT(*) OVER() AS total_count
      FROM public.users

    `;
const params = [];
if(nameFilter){
params.push(`%${nameFilter}%`);
sql += `WHERE name ILIKE $${params.length}`;
}

 params.push(lim);
    sql += ` ORDER BY created_at DESC LIMIT $${params.length}`;

    params.push(off);
    sql += ` OFFSET $${params.length};`;

    const result = await query(sql, params);

    const total = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;
    const data = result.rows.map(({ total_count, ...role }) => role);

    return { data, total };

}catch(err){

 logger.error({ err, limit, offset, nameFilter }, 'Error en getUsers');
    throw new Error('Error al obtener usuarios desde la base de datos');
}
}


export const getUserById = async (id) => {
  try {
    const sql = `
      SELECT id, first_name, last_name, email, phone, password_hash,profile_picture_url, status, last_login_at,created_at, updated_at,
      FROM public.users
      WHERE id = $1;
    `;
    const result = await query(sql, [id]);
    return result.rows[0] || null;
  } catch (err) {
    logger.error({ err, id }, 'Error en getUserById');
    throw new Error('Error al consultar al usuario por id');
  }
};


export const getUserByName = async (name) => {
  try {
    const sql = `
      SELECT id, first_name, last_name, email, phone, password_hash,profile_picture_url, status, last_login_at,created_at, updated_at,
      FROM public.users
      WHERE id = $1;
    `;
    const result = await query(sql, [name]);
    return result.rows[0] || null;
  } catch (err) {
    logger.error({ err, name }, 'Error en getUserByName');
    throw new Error('Error al consultar al usuario por nombre');
  }
};
