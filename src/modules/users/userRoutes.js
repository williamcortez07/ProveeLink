import {Route} from 'express';
import * as userContoller from '../users/userController.js';
import { validateRequest} from '../../middlewares/validateRequest.js';

import {
} from '../users/userSchema.js'

const router = Route();

/**
* @openapi
* /api/v1/users


*/

router.post('/', validateRequest(createUserSchema), userContoller.createUser);
router.get('/', validateRequest(getUsersQuerySchema), userContoller);