import * as commentService from "../comments/commentService.js";
import { asyncWrapper } from "../../utils/asyncWrapper.js";

export const createComment = asyncWrapper(async (req, res) => {
  const userId = req.user.id;
  const newComment = await commentService.createCommentService(
    userId,
    req.body,
  );
  res.status(201).json({
    success: true,
    message: "Comentario registrado exitosamente",
    data: newComment,
  });
});

export const getComments = asyncWrapper(async (req, res) => {
  const result = await commentService.getCommentsService(req.query);
  res.status(200).json({
    success: true,
    message: "Comentarios recuperados exitosamente",
    data: result.data,
    pagination: result.pagination,
  });
});

export const getCommentById = asyncWrapper(async (req, res) => {
  const comment = await commentService.getCommentByIdService(req.params.id);
  res.status(200).json({
    success: true,
    message: "Comentario encontrado exitosamente",
    data: comment,
  });
});

export const updateComment = asyncWrapper(async (req, res) => {
  const updatedComment = await commentService.updateCommentService(
    req.params.id,
    req.user.id,
    req.user.role_name,
    req.body.content,
  );
  res.status(200).json({
    success: true,
    message: "Comentario actualizado exitosamente",
    data: updatedComment,
  });
});

export const deleteComment = asyncWrapper(async (req, res) => {
  await commentService.deleteCommentService(
    req.params.id,
    req.user.id,
    req.user.role_name,
  );
  res.status(200).json({
    success: true,
    message: "Comentario eliminado exitosamente",
  });
});

export const changeCommentStatus = asyncWrapper(async (req, res) => {
  const updatedComment = await commentService.changeCommentStatusService(
    req.params.id,
    req.body.status,
  );
  res.status(200).json({
    success: true,
    message: "Estado del comentario actualizado exitosamente",
    data: updatedComment,
  });
});
