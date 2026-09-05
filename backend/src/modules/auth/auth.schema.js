import { z } from "zod";

export const loginSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .email("El correo electrónico no tiene un formato válido"),
    password: z.string().min(1, "La contraseña es requerida"),
  }),
  query: z.any(),
  params: z.any(),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, "El refreshToken es requerido"),
  }),
  query: z.any(),
  params: z.any(),
});

export const registerSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .email("El correo electrónico no tiene un formato válido"),
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres")
      .regex(
        /[A-Z]/,
        "La contraseña debe contener al menos una letra mayúscula",
      )
      .regex(/[0-9]/, "La contraseña debe contener al menos un número"),
  }),
  query: z.any(),
  params: z.any(),
});

export const verifyEmailSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .email("El correo electrónico no tiene un formato válido"),
    otp: z
      .string()
      .length(6, "El código OTP debe tener exactamente 6 dígitos")
      .regex(/^\d{6}$/, "El código OTP debe contener solo dígitos"),
  }),
  query: z.any(),
  params: z.any(),
});

export const resendOtpSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .email("El correo electrónico no tiene un formato válido"),
  }),
  query: z.any(),
  params: z.any(),
});

export const adminVerifySchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .email("El correo electrónico no tiene un formato válido"),
    code: z
      .string()
      .length(6, "El código OTP debe tener exactamente 6 dígitos")
      .regex(/^\d{6}$/, "El código OTP debe contener solo dígitos"),
  }),
  query: z.any(),
  params: z.any(),
});

export const adminResendSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .email("El correo electrónico no tiene un formato válido"),
  }),
  query: z.any(),
  params: z.any(),
});
