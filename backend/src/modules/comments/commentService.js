import * as commentRepository from "../comments/commentRepository.js";
import * as supplierRepository from "../suppliers/supplierRepository.js";
import * as productRepository from "../products/productRepository.js";
import { AppError } from "../../utils/AppError.js";

const DEFAULT_STATUS = "visible";
const ALLOWED_SORT_FIELDS = new Set(["created_at", "updated_at", "status"]);

// ── Helpers de autorización ───────────────────────────────────────────────────

/**
 * Verifica si el usuario autenticado puede operar sobre el comentario.
 * Solo el autor del comentario o un Administrador tienen permisos.
 */
const assertOwnerOrAdmin = (comment, requestingUserId, roleName) => {
  const isAdmin = (roleName || "").toUpperCase() === "ADMINISTRADOR";
  const isOwner = comment.user_id === requestingUserId;

  if (!isAdmin && !isOwner) {
    throw new AppError(
      "No tienes permisos para realizar esta acción sobre el comentario",
      403,
    );
  }
};

// ── Servicios ─────────────────────────────────────────────────────────────────

/**
 * Crea un nuevo comentario.
 * El user_id proviene siempre del JWT, nunca del cuerpo del request.
 * Valida la existencia del proveedor o producto antes de insertar.
 */
export const createCommentService = async (userId, body) => {
  const { supplier_id, product_id, content } = body;

  // Validar existencia del destinatario (proveedor o producto)
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

  return commentRepository.createComment({
    user_id: userId,
    supplier_id: supplier_id ?? null,
    product_id: product_id ?? null,
    content,
    status: DEFAULT_STATUS,
  });
};

/**
 * Obtiene un listado paginado de comentarios con filtros opcionales.
 */
export const getCommentsService = async ({
  page = 1,
  pageSize = 10,
  sortBy,
  sortOrder,
  supplier_id,
  product_id,
  status,
  user_id,
}) => {
  const safeSortBy = ALLOWED_SORT_FIELDS.has(sortBy) ? sortBy : "created_at";
  const safeSortOrder = sortOrder === "asc" ? "asc" : "desc";
  const offset = (page - 1) * pageSize;

  const { data, total } = await commentRepository.getComments({
    limit: pageSize,
    offset,
    filters: { supplier_id, product_id, status, user_id },
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

/**
 * Obtiene un comentario por su UUID.
 * Lanza 404 si no existe.
 */
export const getCommentByIdService = async (id) => {
  const comment = await commentRepository.getCommentById(id);
  if (!comment) {
    throw new AppError("Comentario no encontrado", 404);
  }
  return comment;
};

/**
 * Actualiza el contenido de un comentario.
 * Solo el autor o un Administrador pueden modificarlo.
 * No permite cambiar el destinatario (supplier_id / product_id).
 */
export const updateCommentService = async (
  id,
  requestingUserId,
  requestingRoleName,
  content,
) => {
  const comment = await commentRepository.getCommentById(id);
  if (!comment) {
    throw new AppError("Comentario no encontrado", 404);
  }

  assertOwnerOrAdmin(comment, requestingUserId, requestingRoleName);

  const updated = await commentRepository.updateComment(id, content);
  return updated;
};

/**
 * Elimina un comentario permanentemente.
 * Solo el autor o un Administrador pueden eliminarlo.
 */
export const deleteCommentService = async (
  id,
  requestingUserId,
  requestingRoleName,
) => {
  const comment = await commentRepository.getCommentById(id);
  if (!comment) {
    throw new AppError("Comentario no encontrado", 404);
  }

  assertOwnerOrAdmin(comment, requestingUserId, requestingRoleName);

  await commentRepository.deleteComment(id);
};

/**
 * Cambia el estado de un comentario (moderación).
 * Esta función debe ser invocada exclusivamente por rutas protegidas con rol Administrador.
 */
export const changeCommentStatusService = async (id, status) => {
  const comment = await commentRepository.getCommentById(id);
  if (!comment) {
    throw new AppError("Comentario no encontrado", 404);
  }

  const updated = await commentRepository.updateCommentStatus(id, status);
  return updated;
};
