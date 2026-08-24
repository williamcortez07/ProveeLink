import * as ratingRepository from "../ratings/ratingRepository.js";
import * as supplierRepository from "../suppliers/supplierRepository.js";
import * as productRepository from "../products/productRepository.js";
import { AppError } from "../../utils/AppError.js";

const ALLOWED_SORT_FIELDS = new Set(["score", "created_at"]);

const assertOwnerOrAdmin = (rating, requestingUserId, roleName) => {
  const isAdmin = (roleName || "").toUpperCase() === "ADMINISTRADOR";
  const isOwner = rating.user_id === requestingUserId;

  if (!isAdmin && !isOwner) {
    throw new AppError(
      "No tienes permisos para realizar esta acción sobre el rating",
      403,
    );
  }
};

export const upsertRatingService = async (userId, body) => {
  const { supplier_id, product_id, score } = body;

  if (supplier_id) {
    const supplier = await supplierRepository.getSupplierById(supplier_id);
    if (!supplier) {
      throw new AppError(
        "El proveedor especificado no existe en el sistema",
        404,
      );
    }
  }

  if (product_id) {
    const product = await productRepository.getProductById(product_id);
    if (!product) {
      throw new AppError(
        "El producto especificado no existe en el sistema",
        404,
      );
    }
  }

  return ratingRepository.upsertRating({
    user_id: userId,
    supplier_id: supplier_id ?? null,
    product_id: product_id ?? null,
    score,
  });
};

export const getRatingsService = async ({
  page = 1,
  pageSize = 10,
  sortBy,
  sortOrder,
  supplier_id,
  product_id,
  user_id,
}) => {
  const safeSortBy = ALLOWED_SORT_FIELDS.has(sortBy) ? sortBy : "created_at";
  const safeSortOrder = sortOrder === "asc" ? "asc" : "desc";
  const offset = (page - 1) * pageSize;

  const { data, total } = await ratingRepository.getRatings({
    limit: pageSize,
    offset,
    filters: { supplier_id, product_id, user_id },
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

export const getRatingByIdService = async (id) => {
  const rating = await ratingRepository.getRatingById(id);
  if (!rating) {
    throw new AppError("Rating no encontrado", 404);
  }
  return rating;
};

export const getMyRatingsService = async (userId, queryParams) => {
  return getRatingsService({ ...queryParams, user_id: userId });
};

export const updateRatingService = async (
  id,
  requestingUserId,
  requestingRoleName,
  score,
) => {
  const rating = await ratingRepository.getRatingById(id);
  if (!rating) {
    throw new AppError("Rating no encontrado", 404);
  }

  assertOwnerOrAdmin(rating, requestingUserId, requestingRoleName);

  const updated = await ratingRepository.updateRating(id, score);
  return updated;
};

export const deleteRatingService = async (
  id,
  requestingUserId,
  requestingRoleName,
) => {
  const rating = await ratingRepository.getRatingById(id);
  if (!rating) {
    throw new AppError("Rating no encontrado", 404);
  }

  assertOwnerOrAdmin(rating, requestingUserId, requestingRoleName);

  await ratingRepository.deleteRating(id);
};

export const getRatingStatsService = async ({ supplier_id, product_id }) => {
  if (supplier_id) {
    const supplier = await supplierRepository.getSupplierById(supplier_id);
    if (!supplier) {
      throw new AppError(
        "El proveedor especificado no existe en el sistema",
        404,
      );
    }
  }

  if (product_id) {
    const product = await productRepository.getProductById(product_id);
    if (!product) {
      throw new AppError(
        "El producto especificado no existe en el sistema",
        404,
      );
    }
  }

  return ratingRepository.getRatingStats({ supplier_id, product_id });
};
