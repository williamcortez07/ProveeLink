import { Router } from "express";
import * as userController from "../users/userController.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import {
  createUserSchema,
  getUsersSchema,
  searchUsersSchema,
  userIdParamSchema,
  updateUserSchema,
  changeStatusSchema,
} from "../users/userSchema.js";

const router = Router();

router.post("/", validateRequest(createUserSchema), userController.createUser);
router.get("/", validateRequest(getUsersSchema), userController.getUsers);
router.get(
  "/search",
  validateRequest(searchUsersSchema),
  userController.searchUsers,
);
router.get(
  "/:id",
  validateRequest(userIdParamSchema),
  userController.getUserById,
);
router.put(
  "/:id",
  validateRequest(updateUserSchema),
  userController.updateUser,
);
router.patch(
  "/:id",
  validateRequest(updateUserSchema),
  userController.updateUser,
);
router.patch(
  "/:id/status",
  validateRequest(changeStatusSchema),
  userController.changeUserStatus,
);

export default router;
