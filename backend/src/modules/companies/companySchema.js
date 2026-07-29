import { z } from "zod";

const uuidSchema = z.string().uuid("El ID proporcionado no es un UUID válido");
const phoneRegex = /^\+?[0-9\s\-\.]{7,20}$/;
const statusValues = ["active", "inactive", "suspended", "pending"];

export const createCompanySchema = z.object({
  body: z.object({
    user_id: uuidSchema,
    name: z
      .string()
      .trim()
      .min(2, "El nombre de la empresa debe tener al menos 2 caracteres")
      .max(100, "El nombre de la empresa no debe exceder los 100 caracteres"),

    description: z.string().trim().optional(),
    tax_id: z.string().trim().optional(),
    phone: z
      .string()
      .trim()
      .regex(phoneRegex, "El teléfono no tiene un formato válido"),
    email: z
      .string()
      .trim()
      .email("El correo electrónico no tiene un formato válido"),
    address: z
      .string()
      .trim()
      .min(5, "La dirección debe tener al menos 5 caracteres"),
    state_province: z
      .string()
      .trim()
      .min(
        5,
        "El estado/Provincia o Departamento debe tener al menos 5 caracteres",
      ),
    city: z
      .string()
      .trim()
      .min(5, "La ciudad debe tener al menos 5 caracteres"),
    logo_url: z
      .string()
      .trim()
      .url("La url del logo no es válida")
      .nullish()
      .transform((val) => val ?? null),
    website_url: z
      .string()
      .trim()
      .url("La url del sitio web no es válida")
      .nullish()
      .transform((val) => val ?? null),
  }),
  query: z.any(),
  params: z.any(),
});

export const getCompaniesSchema = z.object({
  body: z.any(),
  params: z.any(),
  query: z.object({
    page: z.coerce.number().int().min(1).catch(1),
    pageSize: z.coerce.number().int().min(1).max(200).catch(20),
    sortBy: z.string().trim().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    status: z.enum(statusValues).optional(),
    user_id: uuidSchema.optional(),
  }),
});

export const searchCompaniesSchema = z.object({
  body: z.any(),
  params: z.any(),
  query: z.object({
    query: z
      .string()
      .trim()
      .min(1, "El término de búsqueda debe tener al menos 1 caracter"),
    page: z.coerce.number().int().min(1).catch(1),
    pageSize: z.coerce.number().int().min(1).max(200).catch(20),
  }),
});

export const companyIdParamSchema = z.object({
  body: z.any(),
  query: z.any(),
  params: z.object({
    id: uuidSchema,
  }),
});

export const updateCompanySchema = z.object({
  body: z
    .object({
      name: z
        .string()
        .trim()
        .min(2, "El nombre de la empresa debe tener al menos 2 caracteres")
        .max(100, "El nombre de la empresa no debe exceder los 100 caracteres")
        .optional(),
      description: z.string().trim().optional(),
      tax_id: z.string().trim().optional(),
      phone: z
        .string()
        .trim()
        .regex(phoneRegex, "El teléfono no tiene un formato válido")
        .optional(),
      email: z
        .string()
        .trim()
        .email("El correo electrónico no tiene un formato válido")
        .optional(),
      address: z
        .string()
        .trim()
        .min(5, "La dirección debe tener al menos 5 caracteres")
        .optional(),
      state_province: z
        .string()
        .trim()
        .min(
          5,
          "El estado/Provincia o Departamento debe tener al menos 5 caracteres",
        )
        .optional(),
      city: z
        .string()
        .trim()
        .min(5, "La ciudad debe tener al menos 5 caracteres")
        .optional(),
      logo_url: z
        .string()
        .trim()
        .url("La url del logo no es válida")
        .nullish()
        .transform((val) => val ?? null),
      website_url: z
        .string()
        .trim()
        .url("La url del sitio web no es válida")
        .nullish()
        .transform((val) => val ?? null),
    })
    .refine(
      (data) => {
        const keys = Object.keys(data).filter((k) => data[k] !== undefined);
        return keys.length > 0;
      },
      { message: "Debe proporcionar al menos un campo para actualizar" },
    ),
  query: z.any(),
  params: z.object({
    id: uuidSchema,
  }),
});
