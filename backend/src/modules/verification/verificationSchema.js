import { z } from "zod";

// ─── createRequestSchema ──────────────────────────────────────────────────────
export const createRequestSchema = z.object({
  body: z.object({
    business_description: z
      .string({ required_error: "La descripción del negocio es requerida" })
      .min(10, "La descripción debe tener al menos 10 caracteres"),
    business_address: z
      .string({ required_error: "La dirección del negocio es requerida" })
      .min(5, "La dirección debe tener al menos 5 caracteres"),
    contact_name: z
      .string()
      .min(2, "El nombre de contacto debe tener al menos 2 caracteres")
      .optional(),
    contact_phone: z.string().optional(),
  }),
  query: z.any(),
  params: z.any(),
});

// ─── updateRequestSchema ──────────────────────────────────────────────────────
export const updateRequestSchema = z
  .object({
    body: z
      .object({
        business_description: z
          .string()
          .min(10, "La descripción debe tener al menos 10 caracteres")
          .optional(),
        business_address: z
          .string()
          .min(5, "La dirección debe tener al menos 5 caracteres")
          .optional(),
        contact_name: z
          .string()
          .min(2, "El nombre de contacto debe tener al menos 2 caracteres")
          .optional(),
        contact_phone: z.string().optional(),
      })
      .refine(
        (data) => Object.values(data).some((v) => v !== undefined),
        { message: "Debe enviar al menos un campo para actualizar" }
      ),
    query: z.any(),
    params: z.object({
      id: z.string().uuid("El ID de la solicitud debe ser un UUID válido"),
    }),
  });

// ─── selectPlanSchema ─────────────────────────────────────────────────────────
export const selectPlanSchema = z.object({
  body: z.object({
    plan_id: z
      .string({ required_error: "El plan_id es requerido" })
      .uuid("El plan_id debe ser un UUID válido"),
  }),
  query: z.any(),
  params: z.object({
    id: z.string().uuid("El ID de la solicitud debe ser un UUID válido"),
  }),
});

// ─── rejectRequestSchema ──────────────────────────────────────────────────────
export const rejectRequestSchema = z.object({
  body: z.object({
    rejection_reason: z
      .string({ required_error: "La razón de rechazo es requerida" })
      .min(5, "La razón de rechazo debe tener al menos 5 caracteres"),
  }),
  query: z.any(),
  params: z.object({
    id: z.string().uuid("El ID de la solicitud debe ser un UUID válido"),
  }),
});

// ─── requestIdParam ───────────────────────────────────────────────────────────
export const requestIdParam = z.object({
  body: z.any(),
  query: z.any(),
  params: z.object({
    id: z.string().uuid("El ID de la solicitud debe ser un UUID válido"),
  }),
});

// ─── addEvidenceSchema ────────────────────────────────────────────────────────
export const addEvidenceSchema = z.object({
  body: z.object({
    file_url: z
      .string({ required_error: "La URL del archivo es requerida" })
      .url("Debe ser una URL válida"),
    evidence_type: z
      .enum(["photo", "document", "facade", "interior", "other"])
      .optional()
      .default("photo"),
    file_name: z.string().optional(),
    display_order: z.number().int().min(0).optional().default(0),
  }),
  query: z.any(),
  params: z.object({
    id: z.string().uuid("El ID de la solicitud debe ser un UUID válido"),
  }),
});

// ─── removeEvidenceSchema ─────────────────────────────────────────────────────
export const removeEvidenceSchema = z.object({
  body: z.any(),
  query: z.any(),
  params: z.object({
    id: z.string().uuid("El ID de la solicitud debe ser un UUID válido"),
    evidenceId: z.string().uuid("El ID de la evidencia debe ser un UUID válido"),
  }),
});

// ─── adminGetRequestsSchema ───────────────────────────────────────────────────
export const adminGetRequestsSchema = z.object({
  body: z.any(),
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((v) => (v ? parseInt(v, 10) : 1)),
    pageSize: z
      .string()
      .optional()
      .transform((v) => (v ? parseInt(v, 10) : 10)),
    status: z.string().optional(),
    search: z.string().optional(),
  }),
  params: z.any(),
});
