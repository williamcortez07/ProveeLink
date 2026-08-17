import * as productRepository from "../products/productRepository.js";
import * as supplierRepository from "../suppliers/supplierRepository.js";
import * as categoryRepository from "../categories/categoryRepository.js";
import { AppError } from "../../utils/AppError.js";

const DEFAULT_STATUS = "activo";
const ALLOWED_SORT_FIELDS = new Set([
  "name",
  "description",
  "price",
  "currency",
  "stock",
  "unit_of_measure",
  "brand",
  "model",
  "status",
  "created_at",
  "updated_at",
]);

export const createProductService = async (productData) => {
  const { name, supplier_id, category_id, image_url, ...rest } = productData;

  const supplier = await supplierRepository.getSupplierById(supplier_id);
  if (!supplier) {
    throw new AppError(
      "El proveedor especificado no existe en nuestro sistema",
      400,
    );
  }

  const category = await categoryRepository.getCategoryById(category_id);
  if (!category) {
    throw new AppError(
      "La categoría especificada no existe en nuestro sistema",
      400,
    );
  }

  const createdProduct = await productRepository.createProduct({
    ...rest,
    name,
    supplier_id,
    category_id,
    status: DEFAULT_STATUS,
  });

  if (image_url) {
    try {
      await productRepository.addProductImage({
        product_id: createdProduct.id,
        image_url,
        is_primary: true,
        display_order: 0,
      });
      createdProduct.primary_image_url = image_url;
    } catch (imgErr) {
      console.warn("No se pudo asociar la imagen inicial del producto:", imgErr);
    }
  }

  return createdProduct;
};

export const getProductService = async ({
  page = 1,
  pageSize = 10,
  sortBy = "created_at",
  sortOrder = "desc",
  status,
  supplier_id,
  category_id,
}) => {
  const safeSortBy = ALLOWED_SORT_FIELDS.has(sortBy) ? sortBy : "created_at";
  const safeSortOrder = sortOrder === "asc" ? "asc" : "desc";
  const offSet = (page - 1) * pageSize;

  const { data, total } = await productRepository.getProducts({
    limit: pageSize,
    offset: offSet,
    filters: { status, supplier_id, category_id },
    sortBy: safeSortBy,
    sortOrder: safeSortOrder,
  });

  return {
    data,
    pagination: {
      page,
      pageSize,
      totalItems: total,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
};

export const searchProductsService = async ({ query, page = 1, pageSize = 10 }) => {
  const offset = (page - 1) * pageSize;
  const { data, total } = await productRepository.searchProducts({
    query,
    limit: pageSize,
    offset,
  });
  return {
    data,
    pagination: {
      page,
      pageSize,
      totalItems: total,
      totalPages: Math.ceil(total / pageSize) || 1,
    },
  };
};

export const getProductByIdService = async (id) => {
  const product = await productRepository.getProductById(id);
  if (!product) {
    throw new AppError("Producto no encontrado", 404);
  }
  return product;
};

export const updateProductService = async (id, updateData) => {
  const product = await productRepository.getProductById(id);
  if (!product) {
    throw new AppError("Producto no encontrado", 404);
  }

  if (
    updateData.supplier_id &&
    updateData.supplier_id !== product.supplier_id
  ) {
    const supplier = await supplierRepository.getSupplierById(
      updateData.supplier_id,
    );
    if (!supplier) {
      throw new AppError(
        "El proveedor especificado no existe en nuestro sistema",
        400,
      );
    }
  }

  if (
    updateData.category_id &&
    updateData.category_id !== product.category_id
  ) {
    const category = await categoryRepository.getCategoryById(
      updateData.category_id,
    );
    if (!category) {
      throw new AppError(
        "La categoría especificada no existe en nuestro sistema",
        400,
      );
    }
  }

  const updatedProduct = await productRepository.updateProduct(id, updateData);
  return updatedProduct;
};

export const changeProductStatusService = async (id, status) => {
  const product = await productRepository.getProductById(id);
  if (!product) {
    throw new AppError("Producto no encontrado", 404);
  }

  const updatedStatusProduct = await productRepository.updateProductStatus(
    id,
    status,
  );
  return updatedStatusProduct;
};

export const deleteProductService = async (id) => {
  const product = await productRepository.getProductById(id);
  if (!product) {
    throw new AppError("Producto no encontrado", 404);
  }
  const deleted = await productRepository.deleteProduct(id);
  return deleted;
};

// ── PRODUCT IMAGES SERVICE ───────────────────────────────────────────────────

export const getProductImagesService = async (productId) => {
  const product = await productRepository.getProductById(productId);
  if (!product) {
    throw new AppError("Producto no encontrado", 404);
  }
  return productRepository.getProductImages(productId);
};

export const addProductImageService = async (productId, imageData) => {
  const product = await productRepository.getProductById(productId);
  if (!product) {
    throw new AppError("Producto no encontrado", 404);
  }

  const newImage = await productRepository.addProductImage({
    product_id: productId,
    image_url: imageData.image_url,
    is_primary: imageData.is_primary ?? false,
    display_order: imageData.display_order ?? 0,
  });

  return newImage;
};

export const deleteProductImageService = async (productId, imageId) => {
  const product = await productRepository.getProductById(productId);
  if (!product) {
    throw new AppError("Producto no encontrado", 404);
  }

  const deleted = await productRepository.deleteProductImage(imageId, productId);
  if (!deleted) {
    throw new AppError("La imagen especificada no existe para este producto", 404);
  }
  return { id: imageId };
};
