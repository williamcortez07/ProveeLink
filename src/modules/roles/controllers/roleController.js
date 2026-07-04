import * as roleService from '../services/roleService.js';
import { asyncWrapper } from '../../../utils/asyncWrapper.js';

export const createRole = asyncWrapper(async (req, res) => {
  const roleData = req.body;
  const newRole = await roleService.createRoleService(roleData);
  
  res.status(201).json({
    success: true,
    message: 'Rol creado exitosamente',
    data: newRole
  });
});

export const getRoles = asyncWrapper(async (req, res) => {
  const result = await roleService.getRolesService(req.query);
  
  res.status(200).json({
    success: true,
    data: result.data,
    meta: result.meta
  });
});

export const getRoleById = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const role = await roleService.getRoleByIdService(id);
  
  res.status(200).json({
    success: true,
    data: role
  });
});

export const updateRole = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  
  const updatedRole = await roleService.updateRoleService(id, updateData);
  
  res.status(200).json({
    success: true,
    message: 'Rol actualizado exitosamente',
    data: updatedRole
  });
});
