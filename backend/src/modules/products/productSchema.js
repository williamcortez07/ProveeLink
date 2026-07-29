import { z } from "zod";
const uuidSchema = z.string().uuid("El ID proporcionado no es un UUID válido");
const statusValues = ["activo", "agotado", "no disponible", "disponible"];
export const createProductSchema = z.object({
  body: z.object({
    supplier_id: uuidSchema,
    category_id: uuidSchema,
    name: z
      .string()
      .trim()
      .min(2, "El nombre debe tener al menos 2 caracteres")
      .max(150, "El nombre no debe exceder los 150 caracteres"),
    description: z
      .string()
      .trim()
      .min(2, "La descripción debe tener al menos 2 caracteres")
      .max(500, "La descripción no debe exceder los 500 caracteres"),
    price: z.number().positive("El precio debe ser un número positivo"),
    currency: z.string().max(3, "no debe exceder los 3 caracteres"),
    stock: z.number().positive("El stock debe ser positivo"),
    unit_of_measure: z
      .string()
      .trim()
      .min(1, "la unidad de medida debe tener al menos 1 caracter")
      .max(20, " La inidad de medida no debe exceder los 20 caracteres"),
    brand: z
      .string()
      .trim()
      .min(2, "La marca debe tener al menos 2 caracteres")
      .max(150, "La marca no debe exceder los 150 caracteres"),
    model: z.string().trim().optional(),
  }),
  query: z.any(),
  params: z.any(),
});

export const getProductsSchema = z.object({
  body: z.any(),
  params: z.any(),
  query: z.object({
    page: z.coerce.number().int().min(1).catch(1),
    pageSize: z.coerce.number().int().min(1).max(100).catch(10),
    sortBy: z.string().trim().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    supplier_id: uuidSchema.optional(),
    category_id: uuidSchema.optional(),
  }),
});

export const searchProductsSchema = z.object({
  body: z.any(),
  params: z.any(),
  query: z.object({
    query: z
      .string()
      .trim()
      .min(1, "El término de búsqueda debe tener al menos 1 caracter"),
    page: z.coerce.number().int().min(1).catch(1),
    pageSize: z.coerce.number().int().min(1).max(100).catch(10),
  }),
});

export const productIdParamsSchema = z.object({
  body: z.any(),
  query: z.any(),
  params: z.object({
    id: uuidSchema,
  }),
});

export const updateProductSchema = z.object({
  body: z
    .object({
      supplier_id: uuidSchema,
      category_id: uuidSchema,
      name: z
        .string()
        .trim()
        .min(2, "El nombre debe tener al menos 2 caracteres")
        .max(15, "El nombre no debe exceder los 150 caracteres"),
      description: z
        .string()
        .trim()
        .min(2, "La descripción debe tener al menos 2 caracteres")
        .max(500, "La descripción no debe exceder los 500 caracteres"),
      price: z.number().positive("El precio debe ser un número positivo"),
      currency: z.string().max(3, "no debe exceder los 3 caracteres"),
      stock: z.number().positive("El stock debe ser positivo"),
      unit_of_measure: z
        .string()
        .trim()
        .min(1, "la unidad de medida debe tener al menos 1 caracter")
        .max(20, " La inidad de medida no debe exceder los 20 caracteres"),
      brand: z
        .string()
        .trim()
        .min(2, "La marca debe tener al menos 2 caracteres")
        .max(150, "La marca no debe exceder los 150 caracteres"),
      model: z.string().trim().optional(),
    })
    .refine(
      (data) => {
        const keys = Object.keys(data).filter((k) => data[k] !== undefined);
        return keys.length > 0;
      },
      {
        message: "Debe proporcionar al menos un campo para actualizar",
      },
    ),
  query: z.any(),
  params: z.object({
    id: uuidSchema,
  }),
});

export const changeStatusSchema = z.object({
  body: z.object({
    status: z.enum(statusValues, {
      errorMap: () => ({
        message:
          "El estado debe ser: activo, no disponible, disponible, agotado ",
      }),
    }),
  }),
  query: z.any(),
  params: z.object({
    id: uuidSchema,
  }),
});
