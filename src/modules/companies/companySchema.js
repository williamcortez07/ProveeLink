import { z } from "zod";
import { Query } from "../../config/db.js";
const uuidSchema = z.string().uuid("El ID proporcionado no esun UUID válido");
const phoneRegex = /^\+?[0-9\s\-\.]{7,20}$/;

export const createCompanySchema = z.object({
  body: z.object({
    user_id: uuidSchema,
    name: z
      .string()
      .trim()
      .min(2, "El nombre de la empresa debe tener almenos 2 caracteres")
      .max(100, "El nombre de la empresa no debe exceder los 100 caracteres"),

    description: z.string().trim().optional(),
    tax_id: z.string().trim().optional(),
    phone: z
      .string()
      .trim()
      .regex(phoneRegex, "El teléfomo no tiene un formato válido"),
    email: z
      .string()
      .trim()
      .email("El correo electrónico no tiene un formato válido"),
    address: z
      .string()
      .trim()
      .min(5, "La dirección debe tener almenos 5 caracteres"),
    state_province: z
      .string()
      .trim()
      .min(
        5,
        "El estado/Provincia o Departamento debe tener almenos 5 caracteres",
      ),
    city: z
      .string()
      .trim()
      .min(5, "La ciudad debe tener al menos 5 caracteres"),
    logo_url: z
      .string()
      .trim()
      .url("La url del logo no es válido")
      .nullish()
      .transform((val) => val ?? null),
    website_url: z
      .string()
      .trim()
      .url("La url del sitio web no es válido")
      .nullish()
      .transform((val) => val ?? null),
  }),
  query: z.any(),
  params: z.any(),
});
