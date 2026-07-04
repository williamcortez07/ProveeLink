import * as userRepository from '../users/userRepository.js';
import {AppError} from  '../../utils/AppError.js';

export const createUserService = async (userData) =>{
const {first_name, last_name, email, phone,password_hash,profile_picture_url, status} = userData;

const newUser = await userRepository.createUser(first_name, last_name, email, phone,password_hash,profile_picture_url, status);
return newUser;
};

