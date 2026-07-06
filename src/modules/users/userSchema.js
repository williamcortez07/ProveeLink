import { z } from "zod";

const uuidSchema = z.string().uuid("El ID proporcionado no es un UUID válido");
const statusValues = ["active", "inactive", "suspended"];

const phoneRegex = /^\+?[0-9\s\-\.]{7,20}$/;
// La contraseña debe tener al menos 8 caracteres, una mayúscula y un número.
// Los símbolos son opcionales para mayor usabilidad.
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export const createUserSchema = z.object({
  body: z.object({
    role_id: uuidSchema,
    first_name: z
      .string()
      .trim()
      .min(2, "El nombre debe tener al menos 2 caracteres")
      .max(100, "El nombre no debe exceder los 100 caracteres"),
    last_name: z
      .string()
      .trim()
      .min(2, "El apellido debe tener al menos 2 caracteres")
      .max(100, "El apellido no debe exceder los 100 caracteres"),
    email: z
      .string()
      .trim()
      .email("El correo electrónico no tiene un formato válido"),
    phone: z
      .string()
      .trim()
      .regex(phoneRegex, "El teléfono no tiene un formato válido")
      .optional(),
    password: z
      .string()
      .trim()
      .regex(
        passwordRegex,
        "La contraseña debe tener al menos 8 caracteres, una mayúscula y un número",
      ),
    profile_picture_url: z
      .string()
      .trim()
      .url("La URL de la foto de perfil no es válida")
      .nullish()
      .transform((val) => val ?? null),
  }),
  query: z.any(),
  params: z.any(),
});

export const getUsersSchema = z.object({
  body: z.any(),
  params: z.any(),
  query: z.object({
    page: z.coerce.number().int().min(1).catch(1),
    pageSize: z.coerce.number().int().min(1).max(100).catch(10),
    sortBy: z.string().trim().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    status: z.enum(statusValues).optional(),
    role_id: uuidSchema.optional(),
  }),
});

export const searchUsersSchema = z.object({
  body: z.any(),
  params: z.any(),
  query: z.object({
    query: z
      .string()
      .trim()
      .min(1, "El término de búsqueda debe tener al menos 1 carácter"),
    page: z.coerce.number().int().min(1).catch(1),
    pageSize: z.coerce.number().int().min(1).max(100).catch(10),
  }),
});

export const userIdParamSchema = z.object({
  body: z.any(),
  query: z.any(),
  params: z.object({
    id: uuidSchema,
  }),
});

export const updateUserSchema = z.object({
  body: z
    .object({
      role_id: uuidSchema.optional(),
      first_name: z
        .string()
        .trim()
        .min(2, "El nombre debe tener al menos 2 caracteres")
        .max(100, "El nombre no debe exceder los 100 caracteres")
        .optional(),
      last_name: z
        .string()
        .trim()
        .min(2, "El apellido debe tener al menos 2 caracteres")
        .max(100, "El apellido no debe exceder los 100 caracteres")
        .optional(),
      email: z
        .string()
        .trim()
        .email("El correo electrónico no tiene un formato válido")
        .optional(),
      phone: z
        .string()
        .trim()
        .regex(phoneRegex, "El teléfono no tiene un formato válido")
        .optional(),
      password: z
        .string()
        .trim()
        .regex(
          passwordRegex,
          "La contraseña debe tener al menos 8 caracteres, una mayúscula y un número",
        )
        .optional(),
      profile_picture_url: z
        .string()
        .trim()
        .url("La URL de la foto de perfil no es válida")
        .nullish()
        .transform((val) => val ?? null),
    })
    .refine(
      (data) => {
        // Ignore profile_picture_url if it was transformed to null from undefined
        const keys = Object.keys(data).filter(
          (k) => data[k] !== undefined,
        );
        return keys.length > 0;
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
    // Second arg to z.enum() must be an options object, not a plain string
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
