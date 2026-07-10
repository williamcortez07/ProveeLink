import * as productService from "../products/productService.js";
import { asyncWrapper } from "../../utils/asyncWrapper";
import { success } from "zod/v4";

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
  const updateduser = await productService.changeProductStatusService(
    req.params.id,
    req.body.status,
  );
  res.status(200).json({
    success: true,
    message: "Estado de producto actualizado correctamente",
    data: updatedProduct,
  });
});
