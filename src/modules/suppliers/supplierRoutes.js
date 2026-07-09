import { Router } from "express";
import * as supplierController from "../suppliers/supplierController.js";
import { validateRequest } from "../../middlewares/validateRequest";
import {
  createSupplierSchema,
  getSupplierSchema,
  searchSupplierSchema,
  supplierParamsSchema,
  updateSupplierSchema,
  changeStatusSchema,
  supplierIdParamsSchema,
} from "../suppliers/supplierSchema.js";
import router from "../users/userRoutes";

const router = Router();

router.post(
  "/",
  validateRequest(createSupplierSchema),
  supplierController.createSupplier,
);

router.get(
  "/",
  validateRequest(getSupplierSchema),
  supplierController.getSupplier,
);

router.get(
  "/search",
  validateRequest(searchSupplierSchema),
  supplierController.searchSupplier,
);

router.get(
  "/:id",
  validateRequest(supplierIdParamsSchema),
  supplierController.getSupplierById,
);

router.put(
  "/:id",
  validateRequest(updateSupplierSchema),
  supplierController.updateSupplier,
);

router.patch(
  "/:id/status",
  validateRequest(changeStatusSchema),
  supplierController.changeSupplierStatus,
);
