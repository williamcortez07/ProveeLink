import * as categoryRepository from "../categories/categoryRepository.js";
import { AppError } from "../../utils/AppError.js";

export const createCategoryService = async (categoryData) => {
  const { parent_id, name, icon_url } = categoryData;
  const existingCategory = await categoryRepository.getCategoryByName(name);
  if (existingCategory) {
    throw new AppError(`La categoria con el nombre '${name}' ya existe`, 409);
  }

  const newCategory = await categoryRepository.createCategory({
    parent_id,
    name,
    icon_url,
  });
  return newCategory;
};

export const getCategoryService = async ({ page, limit, name }) => {
  const offset = (page - 1) * limit;
  const { data, total } = await categoryRepository.getCategories({
    limit,
    offset,
    filters: name ? { name } : {},
  });

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getCategoryByIdService = async (id) => {
  const category = await categoryRepository.getCategoryById(id);
  if (!category) {
    throw new AppError("Categoria no encontrada", 404);
  }

  return category;
};

export const updateCategoryService = async (id, updateData) => {
  const existingCategory = await categoryRepository.getCategoryById(id);
  if (!existingCategory) {
    throw new AppError("Categoria no encontrada", 404);
  }
  if (updateData.name && updateData.name !== existingCategory.name) {
    const categoryWithSameName = await categoryRepository.getCategoryByName(
      updateData.name,
    );
    if (categoryWithSameName) {
      throw new AppError(
        `El nombre de la categoria '${updateData.name}' ya está en uso por otra categoria`,
        409,
      );
    }
  }
  const updatedCategory = await categoryRepository.updateCategory(
    id,
    updateData,
  );
  return updatedCategory;
};
