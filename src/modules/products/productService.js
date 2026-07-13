import * as productRepository from "../products/productRepository.js";
import * as supplierRepository from "../suppliers/supplierRepository.js";
import * as categoryRepository from "../categories/categoryRepository.js";
import { AppError } from "../../utils/AppError.js";

const DEFAULT_STATUS = "activo";
const ALLOWEB_SORT_FIELDS = new Set([
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
  const { name, supplier_id, category_id, ...rest } = productData;
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
      "La categoria especificada no existe en nuestro sistema",
      400,
    );
  }

  // si un proveedor ya tiene registrado un producto bajo el mismo
  // nombre no puede registrarlo nuevamente // incluir descripción
  // pero al ser una plataforma con muchos usuarios(proveedore) el mismo producto puede existir varias veces ya que los proveedores son distintis
  // con caracteristicas distintas
  /* const existingProduct = await productRepository.searchProducts(name);
  if (
    existingProduct &&
    existingProduct.data.concat.name.supplier.supplier_id
  ) {
    throw new AppError("El producto ya se encuentra registrado", 409);
  }

  */

  const createdProduct = await productRepository.createProduct({
    ...rest,
    supplier_id,
    category_id,
    status: DEFAULT_STATUS,
  });
  return createdProduct;
};

export const getProductService = async ({
  page,
  pageSize,
  sortBy,
  sortOrder,
  status,
  supplier_id,
  category_id,
}) => {
  const safeSortBy = ALLOWEB_SORT_FIELDS.has(sortBy) ? sortBy : "created_at";
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
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

export const searchProductsService = async ({ query, page, pageSize }) => {
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
      totalPages: Math.ceil(total / pageSize),
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
        "La categoria especificada no existe en nuestro sistema",
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
  const currentStatus = product.status;
  const allowedTransitions = {
    activo: ["agotado", "no disponible", "disponible"],
    agotado: ["no disponible", "disponible"],
    no_disponible: ["agotado", "disponible"],
    disponible: ["agotado", "no disponible"],
  };
  if (!allowedTransitions[currentStatus]?.includes(status)) {
    throw new AppError("transición de estado no permitida ", 400);
  }
  const updatedStatusProduct = await productRepository.updateProductStatus(
    id,
    status,
  );
  return updatedStatusProduct;
};
