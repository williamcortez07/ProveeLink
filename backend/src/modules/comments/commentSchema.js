import { z } from "zod";

const uuidSchema = z.string().uuid("El ID proporcionado no es un UUID válido");
const commentStatusValues = ["visible", "hidden", "under_review"];

const contentField = z
  .string()
  .trim()
  .min(1, "El contenido del comentario no puede estar vacío")
  .max(2000, "El contenido del comentario no debe exceder los 2000 caracteres");

// ── Schemas de request ────────────────────────────────────────────────────────

/**
 * Valida el body al crear un comentario.
 * Regla XOR: exactamente uno de supplier_id o product_id debe estar presente.
 */
export const createCommentSchema = z.object({
  body: z
    .object({
      supplier_id: uuidSchema.optional().nullable(),
      product_id: uuidSchema.optional().nullable(),
      content: contentField,
    })
    .superRefine((data, ctx) => {
      const hasSupplier = !!data.supplier_id;
      const hasProduct = !!data.product_id;

      if (!hasSupplier && !hasProduct) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Debe especificar un destinatario: proporcione supplier_id o product_id",
          path: ["supplier_id"],
        });
      }

      if (hasSupplier && hasProduct) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "El comentario debe dirigirse a un proveedor O a un producto, no a ambos",
          path: ["supplier_id"],
        });
      }
    }),
  query: z.any(),
  params: z.any(),
});

/**
 * Valida los query params al listar comentarios con filtros y paginación.
 */
export const getCommentsSchema = z.object({
  body: z.any(),
  params: z.any(),
  query: z.object({
    page: z.coerce.number().int().min(1).catch(1),
    pageSize: z.coerce.number().int().min(1).max(100).catch(10),
    sortBy: z
      .enum(["created_at", "updated_at", "status"], {
        errorMap: () => ({
          message: "sortBy debe ser: created_at, updated_at o status",
        }),
      })
      .optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    supplier_id: uuidSchema.optional(),
    product_id: uuidSchema.optional(),
    status: z
      .enum(commentStatusValues, {
        errorMap: () => ({
          message: "status debe ser: visible, hidden o under_review",
        }),
      })
      .optional(),
    user_id: uuidSchema.optional(),
  }),
});

/**
 * Valida el param :id como UUID válido.
 * Reutilizable en GET /:id, PUT /:id, DELETE /:id, PATCH /:id/status.
 */
export const commentIdParamsSchema = z.object({
  body: z.any(),
  query: z.any(),
  params: z.object({
    id: uuidSchema,
  }),
});

/**
 * Valida el body al actualizar el contenido de un comentario.
 */
export const updateCommentSchema = z.object({
  body: z.object({
    content: contentField,
  }),
  query: z.any(),
  params: z.object({
    id: uuidSchema,
  }),
});

/**
 * Valida el cambio de estado de un comentario (moderación).
 */
export const changeCommentStatusSchema = z.object({
  body: z.object({
    status: z.enum(commentStatusValues, {
      errorMap: () => ({
        message: "El estado debe ser: visible, hidden o under_review",
      }),
    }),
  }),
  query: z.any(),
  params: z.object({
    id: uuidSchema,
  }),
});
