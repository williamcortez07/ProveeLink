import * as roleRepository from '../repositories/roleRepository.js';
import { AppError } from '../../../utils/AppError.js';

export const createRoleService = async (roleData) => {
  const { name, description } = roleData;
  
  // Validar si el rol ya existe
  const existingRole = await roleRepository.getRoleByName(name);
  if (existingRole) {
    throw new AppError(`El rol con el nombre '${name}' ya existe`, 409);
  }
  
  const newRole = await roleRepository.createRole(name, description);
  return newRole;
};

export const getRolesService = async ({ page, limit, name }) => {
  const offset = (page - 1) * limit;
  const { data, total } = await roleRepository.getRoles(limit, offset, name);
  
  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  };
};

export const getRoleByIdService = async (id) => {
  const role = await roleRepository.getRoleById(id);
  if (!role) {
    throw new AppError('Rol no encontrado', 404);
  }
  return role;
};

export const updateRoleService = async (id, updateData) => {
  // Verificar si el rol existe
  const existingRole = await roleRepository.getRoleById(id);
  if (!existingRole) {
    throw new AppError('Rol no encontrado', 404);
  }
  
  // Si se está intentando cambiar el nombre, validar que no colisione
  if (updateData.name && updateData.name !== existingRole.name) {
    const roleWithSameName = await roleRepository.getRoleByName(updateData.name);
    if (roleWithSameName) {
      throw new AppError(`El nombre de rol '${updateData.name}' ya está en uso por otro rol`, 409);
    }
  }
  
  const updatedRole = await roleRepository.updateRole(id, updateData);
  return updatedRole;
};
