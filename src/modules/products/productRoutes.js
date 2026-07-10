import { Router } from "express";
import * as ProductController from "../products/productController.js";
import { validateRequest } from "../../middlewares/validateRequest";
import {
  createProductSchema,
  getProductsSchema,
  searchProductsSchema,
  productIdParamsSchema,
  updateProductSchema,
  changeStatusSchema,
} from "../products/productSchema.js";

const router = Router();

router.post(
  "/",
  validateRequest(createProductSchema),
  ProductController.createProduct,
);
router.get(
  "/",
  validateRequest(getProductsSchema),
  ProductController.getProducts,
);

router.get(
  "/search",
  validateRequest(searchProductsSchema),
  ProductController.searchProducts,
);

router.get(
  "/:id",
  validateRequest(productIdParamsSchema),
  ProductController.getProductById,
);

router.put(
  "/:id",
  validateRequest(updateProductSchema),
  ProductController.updateProduct,
);

router.patch(
  "/:id",
  validateRequest(updateProductSchema),
  ProductController.updateProduct,
);

router.patch(
  "/:id/status",
  validateRequest(changeStatusSchema),
  ProductController.changeProductStatus,
);

export default router;
