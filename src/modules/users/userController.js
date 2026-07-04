import * as userService from '../users/userService.js';
import { asyncWrapper} from '../../utils/asyncWrapper.js';
import { success } from 'zod/v4';

export const createUser = asyncWrapper(async (req, res) =>{
const userData = req.body;
const newUser = await userService.createUserService(userData);
res.status(201).json({
success: true,
message: 'Usuario creado existosamente',
data: newUser
});
});

