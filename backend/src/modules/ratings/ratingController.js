import * as ratingService from "../ratings/ratingService.js";
import { asyncWrapper } from "../../utils/asyncWrapper.js";

export const upsertRating = asyncWrapper(async (req, res) => {
  const { rating, created } = await ratingService.upsertRatingService(
    req.user.id,
    req.body,
  );

  if (created) {
    return res.status(201).json({
      success: true,
      message: "Rating registrado exitosamente",
      data: rating,
    });
  }

  res.status(200).json({
    success: true,
    message: "Rating actualizado exitosamente",
    data: rating,
  });
});

export const getRatings = asyncWrapper(async (req, res) => {
  const result = await ratingService.getRatingsService(req.query);
  res.status(200).json({
    success: true,
    message: "Ratings recuperados exitosamente",
    data: result.data,
    pagination: result.pagination,
  });
});

export const getRatingStats = asyncWrapper(async (req, res) => {
  const stats = await ratingService.getRatingStatsService(req.query);
  res.status(200).json({
    success: true,
    message: "Estadísticas de ratings obtenidas exitosamente",
    data: stats,
  });
});

export const getMyRatings = asyncWrapper(async (req, res) => {
  const result = await ratingService.getMyRatingsService(
    req.user.id,
    req.query,
  );
  res.status(200).json({
    success: true,
    message: "Tus ratings recuperados exitosamente",
    data: result.data,
    pagination: result.pagination,
  });
});

export const getRatingById = asyncWrapper(async (req, res) => {
  const rating = await ratingService.getRatingByIdService(req.params.id);
  res.status(200).json({
    success: true,
    message: "Rating encontrado exitosamente",
    data: rating,
  });
});

export const updateRating = asyncWrapper(async (req, res) => {
  const updatedRating = await ratingService.updateRatingService(
    req.params.id,
    req.user.id,
    req.user.role_name,
    req.body.score,
  );
  res.status(200).json({
    success: true,
    message: "Rating actualizado exitosamente",
    data: updatedRating,
  });
});

export const deleteRating = asyncWrapper(async (req, res) => {
  await ratingService.deleteRatingService(
    req.params.id,
    req.user.id,
    req.user.role_name,
  );
  res.status(200).json({
    success: true,
    message: "Rating eliminado exitosamente",
  });
});
