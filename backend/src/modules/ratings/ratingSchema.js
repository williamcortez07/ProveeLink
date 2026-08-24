import { z } from "zod";

const uuidSchema = z.string().uuid("El ID proporcionado no es un UUID válido");

const scoreField = z
  .number({
    required_error: "El score es obligatorio",
    invalid_type_error: "El score debe ser un número entero",
  })
  .int("El score debe ser un número entero")
  .min(1, "El score mínimo permitido es 1")
  .max(5, "El score máximo permitido es 5");

const assertXorTarget = (data, ctx) => {
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
        "El rating debe dirigirse a un proveedor O a un producto, no a ambos",
      path: ["supplier_id"],
    });
  }
};

export const createRatingSchema = z.object({
  body: z
    .object({
      supplier_id: uuidSchema.optional().nullable(),
      product_id: uuidSchema.optional().nullable(),
      score: scoreField,
    })
    .superRefine(assertXorTarget),
  query: z.any(),
  params: z.any(),
});

export const getRatingsSchema = z.object({
  body: z.any(),
  params: z.any(),
  query: z.object({
    page: z.coerce.number().int().min(1).catch(1),
    pageSize: z.coerce.number().int().min(1).max(100).catch(10),
    sortBy: z
      .enum(["score", "created_at"], {
        errorMap: () => ({
          message: "sortBy debe ser: score o created_at",
        }),
      })
      .optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    supplier_id: uuidSchema.optional(),
    product_id: uuidSchema.optional(),
    user_id: uuidSchema.optional(),
  }),
});

export const getRatingStatsSchema = z.object({
  body: z.any(),
  params: z.any(),
  query: z
    .object({
      supplier_id: uuidSchema.optional(),
      product_id: uuidSchema.optional(),
    })
    .superRefine((data, ctx) => {
      const hasSupplier = !!data.supplier_id;
      const hasProduct = !!data.product_id;

      if (!hasSupplier && !hasProduct) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "Debe proporcionar supplier_id o product_id para obtener las estadísticas",
          path: ["supplier_id"],
        });
      }

      if (hasSupplier && hasProduct) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Proporcione únicamente supplier_id o product_id, no ambos",
          path: ["supplier_id"],
        });
      }
    }),
});

export const ratingIdParamsSchema = z.object({
  body: z.any(),
  query: z.any(),
  params: z.object({
    id: uuidSchema,
  }),
});

export const updateRatingSchema = z.object({
  body: z.object({
    score: scoreField,
  }),
  query: z.any(),
  params: z.object({
    id: uuidSchema,
  }),
});
