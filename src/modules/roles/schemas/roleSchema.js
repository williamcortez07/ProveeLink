import { z } from 'zod';

export const createRoleSchema = z.object({
  body: z.object({
    name: z.string()
      .trim()
      .min(2, 'El nombre del rol debe tener al menos 2 caracteres')
      .max(50, 'El nombre del rol no puede exceder los 50 caracteres'),
    description: z.string().trim().optional(),
  }),
  query: z.any(),
  params: z.any(),
});

export const updateRoleSchema = z.object({
  body: z.object({
    name: z.string()
      .trim()
      .min(2, 'El nombre del rol debe tener al menos 2 caracteres')
      .max(50, 'El nombre del rol no puede exceder los 50 caracteres')
      .optional(),
    description: z.string().trim().optional(),
  }).refine(data => data.name !== undefined || data.description !== undefined, {
    message: 'Debe proporcionar al menos un campo para actualizar (name o description)'
  }),
  query: z.any(),
  params: z.object({
    id: z.string().uuid('El ID proporcionado no es un UUID válido'),
  }),
});

export const roleIdParamSchema = z.object({
  body: z.any(),
  query: z.any(),
  params: z.object({
    id: z.string().uuid('El ID proporcionado no es un UUID válido'),
  }),
});

export const getRolesQuerySchema = z.object({
  body: z.any(),
  params: z.any(),
  query: z.object({
    // z.coerce.number() convierte el string a número antes de validar.
    // .catch(N) devuelve N si la conversión falla (ej: "", "abc", undefined).
    // Esto hace el schema robusto ante strings vacíos que Swagger UI envía
    // cuando el usuario no llena campos opcionales en "Try it out".
    page: z.coerce.number().int().min(1).catch(1),
    limit: z.coerce.number().int().min(1).max(100).catch(10),

    // Si el filtro de nombre llega como string vacío desde Swagger, lo descartamos
    name: z.string().trim().transform(v => v === '' ? undefined : v).optional(),
  }),
});
