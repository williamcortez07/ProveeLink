import * as categoryService from "../categories/categoryService.js";
import { asyncWrapper } from "../../utils/asyncWrapper.js";

export const createCategory = asyncWrapper(async (req, res) => {
  const categoryData = req.body;
  const newCategory = await categoryService.createCategoryService(categoryData);
  res.status(201).json({
    success: true,
    message: "Categoria creada exitosamente",
    data: newCategory,
  });
});

export const getCategory = asyncWrapper(async (req, res) => {
  const result = await categoryService.getCategoryService(req.query);
  res.status(200).json({
    success: true,
    data: result.data,
    meta: result.meta,
  });
});

export const getCategoryById = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const category = await categoryService.getCategoryByIdService(id);
  res.status(200).json({
    success: true,
    data: category,
  });
});

export const updateCategory = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;
  const updatedCategory = await categoryService.updateCategoryService(
    id,
    updateData,
  );
  res.status(200).json({
    success: true,
    message: "Categoria actualizada correctamente",
    data: updatedCategory,
  });
});

export const deleteCategory = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const deleted = await categoryService.deleteCategoryService(id);
  res.status(200).json({
    success: true,
    message: `Categoría '${deleted?.name}' eliminada exitosamente.`,
    data: deleted,
  });
});
