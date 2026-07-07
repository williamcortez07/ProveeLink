import { z } from "zod";
import { query } from "../../config/db.js";
const statusValues = ["activo", "inactivo"];

export const createCategorySchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, "El nombre de la categoria debe tener almenos 2 caracteres")
      .max(
        100,
        "El nombre de la categoria no puede exceder los 100 caracteres",
      ),
    icon_url: z.string().trim().optional(),
  }),
  query: z.any(),
  params: z.any(),
});

export const updateCategorySchema = z.object({
  body: z
    .object({
      name: z
        .string()
        .trim()
        .min(2, "El nombre de la categoria debe tener almenos 2 caracteres")
        .max(
          100,
          "El nombre de la categoria no puede exceder los 100 caracteres",
        )
        .optional(),
      icon_url: z.string().trim().optional(),
    })
    .refine((data) => data.name !== undefined || data.icon_url !== undefined, {
      message: "Debe proporcionar al menos un campo para actualizar",
    }),
  query: z.any(),
  params: z.object({
    id: z.string().uuid("El ID proporcionado no es un UUID válido"),
  }),
});

export const categoryIdParamSchema = z.object({
  body: z.any(),
  query: z.any(),
  params: z.object({
    id: z.string().uuid("El ID proporcionado no es un UUID válido"),
  }),
});

export const getCategoryQuerySchema = z.object({
  body: z.any(),
  params: z.any(),
  query: z.object({
    page: z.coerce.number().int().min(1).catch(1),
    limit: z.coerce.number().int().min(1).max(100).catch(10),
    name: z
      .string()
      .trim()
      .transform((v) => (v === "" ? undefined : v))
      .optional(),
  }),
});
