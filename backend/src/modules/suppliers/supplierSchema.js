import { z } from "zod";
const uuidSchema = z.string().uuid("El Id proporcionado no es un UUID válido");
const statusValues = ["active", "inactive", "suspended"];

export const createSupplierSchema = z.object({
  body: z.object({
    company_id: uuidSchema,
    supplier_type: z
      .string()
      .trim()
      .min(2, "El tipo de proveedor debe tener al menos 2 caracteres")
      .max(50, "El tipo de proveedor no debe exceder los 50 caracteres"),
    service_description: z
      .string()
      .trim()
      .min(
        5,
        "La descripción de los servicios debe tener al menos 5 caracteres",
      ),
    geographic_coverage: z.enum(["local", "regional", "national"], {
      errorMap: () => ({
        message: "La cobertura geográfica debe ser: local, regional o national",
      }),
    }),
    operating_hours: z
      .string()
      .trim()
      .min(5, "El horario de operaciones debe tener al menos 5 caracteres")
      .max(150, "El horario de operaciones no debe exceder los 150 caracteres"),
  }),
  query: z.any(),
  params: z.any(),
});

export const getSupplierSchema = z.object({
  body: z.any(),
  params: z.any(),
  query: z.object({
    page: z.coerce.number().int().min(1).catch(1),
    pageSize: z.coerce.number().int().min(1).max(100).catch(10),
    sortBy: z.string().trim().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    company_id: uuidSchema.optional(),
  }),
});

export const searchSupplierSchema = z.object({
  body: z.any(),
  params: z.any(),
  query: z.object({
    query: z
      .string()
      .trim()
      .min(1, "El término de búsqueda debe tener al menos 1 caracter"),
    page: z.coerce.number().int().min(1).catch(1),
    pageSize: z.coerce.number().int().min(1).max(200).catch(10),
  }),
});

export const supplierIdParamsSchema = z.object({
  body: z.any(),
  query: z.any(),
  params: z.object({
    id: uuidSchema,
  }),
});

export const updateSupplierSchema = z.object({
  body: z
    .object({
      supplier_type: z
        .string()
        .trim()
        .min(2, "El tipo de proveedor debe tener al menos 2 caracteres")
        .max(50, "El tipo de proveedor no debe exceder los 50 caracteres")
        .optional(),
      service_description: z
        .string()
        .trim()
        .min(
          5,
          "La descripción de los servicios debe tener al menos 5 caracteres",
        )
        .optional(),
      geographic_coverage: z
        .enum(["local", "regional", "national"], {
          errorMap: () => ({
            message: "La cobertura geográfica debe ser: local, regional o national",
          }),
        })
        .optional(),
      operating_hours: z
        .string()
        .trim()
        .min(5, "El horario de operaciones debe tener al menos 5 caracteres")
        .max(150, "El horario de operaciones no debe exceder los 150 caracteres")
        .optional(),
    })
    .refine(
      (data) => {
        const Keys = Object.keys(data).filter((k) => data[k] !== undefined);
        return Keys.length > 0;
      },
      { message: "Debe proporcionar al menos un campo para actualizar" },
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
        message: "El estado debe ser: active, inactive o suspended",
      }),
    }),
  }),
  query: z.any(),
  params: z.object({
    id: uuidSchema,
  }),
});

// Alias para compatibilidad con rutas antiguas
export const supplierParamsSchema = supplierIdParamsSchema;
