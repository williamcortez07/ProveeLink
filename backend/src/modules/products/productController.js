import * as productService from "../products/productService.js";
import { asyncWrapper } from "../../utils/asyncWrapper.js";

export const createProduct = asyncWrapper(async (req, res) => {
  const newProduct = await productService.createProductService(req.body);
  res.status(201).json({
    success: true,
    message: "Producto registrado correctamente",
    data: newProduct,
  });
});

export const getProducts = asyncWrapper(async (req, res) => {
  const result = await productService.getProductService(req.query);
  res.status(200).json({
    success: true,
    message: "Productos recuperados exitosamente",
    data: result.data,
    pagination: result.pagination,
  });
});

export const searchProducts = asyncWrapper(async (req, res) => {
  const result = await productService.searchProductsService(req.query);
  res.status(200).json({
    success: true,
    message: "Búsqueda de productos realizada con éxito",
    data: result.data,
    pagination: result.pagination,
  });
});

export const getProductById = asyncWrapper(async (req, res) => {
  const product = await productService.getProductByIdService(req.params.id);
  res.status(200).json({
    success: true,
    message: "Producto encontrado exitosamente",
    data: product,
  });
});

export const updateProduct = asyncWrapper(async (req, res) => {
  const updatedProduct = await productService.updateProductService(
    req.params.id,
    req.body,
  );
  res.status(200).json({
    success: true,
    message: "Producto actualizado correctamente",
    data: updatedProduct,
  });
});

export const changeProductStatus = asyncWrapper(async (req, res) => {
  const updatedProduct = await productService.changeProductStatusService(
    req.params.id,
    req.body.status,
  );
  res.status(200).json({
    success: true,
    message: "Estado de producto actualizado correctamente",
    data: updatedProduct,
  });
});

export const deleteProduct = asyncWrapper(async (req, res) => {
  await productService.deleteProductService(req.params.id);
  res.status(200).json({
    success: true,
    message: "Producto eliminado correctamente",
  });
});

// ── PRODUCT IMAGES CONTROLLERS ─────────────────────────────────────────────

export const getProductImages = asyncWrapper(async (req, res) => {
  const images = await productService.getProductImagesService(req.params.id);
  res.status(200).json({
    success: true,
    message: "Imágenes del producto recuperadas exitosamente",
    data: images,
  });
});

export const addProductImage = asyncWrapper(async (req, res) => {
  const newImage = await productService.addProductImageService(
    req.params.id,
    req.body,
  );
  res.status(201).json({
    success: true,
    message: "Imagen agregada al producto correctamente",
    data: newImage,
  });
});

export const deleteProductImage = asyncWrapper(async (req, res) => {
  await productService.deleteProductImageService(
    req.params.id,
    req.params.imageId,
  );
  res.status(200).json({
    success: true,
    message: "Imagen eliminada del producto correctamente",
  });
});
