import { z } from "zod";

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .email("El correo electrónico no tiene un formato válido"),
    password: z
      .string()
      .min(1, "La contraseña es requerida"),
  }),
  query: z.any(),
  params: z.any(),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z
      .string()
      .min(1, "El refreshToken es requerido"),
  }),
  query: z.any(),
  params: z.any(),
});
