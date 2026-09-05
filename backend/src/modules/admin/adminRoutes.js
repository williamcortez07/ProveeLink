import { Router } from "express";
import * as adminController from "./adminController.js";
import { authenticate, authorize } from "../../middlewares/auth.middlewares.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import { z } from "zod";

const router = Router();

// Todas las rutas del panel administrativo requieren autenticación + rol Admin
router.use(authenticate);
router.use(authorize("Admin"));

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMAS DE VALIDACIÓN
// ─────────────────────────────────────────────────────────────────────────────

const uuidParam = z.object({
  params: z.object({ id: z.string().uuid("ID inválido") }),
  body: z.any(),
  query: z.any(),
});

const createAdminSchema = z.object({
  body: z.object({
    first_name: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(100),
    last_name: z.string().min(2, "El apellido debe tener al menos 2 caracteres").max(100),
    email: z.string().trim().email("El correo electrónico no tiene un formato válido"),
    password: z
      .string()
      .min(8, "La contraseña debe tener al menos 8 caracteres")
      .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
      .regex(/[0-9]/, "Debe contener al menos un número"),
    phone: z.string().max(20).optional().nullable(),
  }),
  query: z.any(),
  params: z.any(),
});

const changeStatusSchema = z.object({
  body: z.object({
    status: z.enum(["active", "inactive", "suspended"], {
      errorMap: () => ({ message: "Estado inválido. Valores permitidos: active, inactive, suspended" }),
    }),
  }),
  params: z.object({ id: z.string().uuid("ID inválido") }),
  query: z.any(),
});

// ─────────────────────────────────────────────────────────────────────────────
// RUTAS
// ─────────────────────────────────────────────────────────────────────────────

// Dashboard
router.get("/stats", adminController.getDashboardStats);

// Usuarios
router.get("/users", adminController.getAllUsers);
router.patch("/users/:id/status", validateRequest(changeStatusSchema), adminController.changeUserStatus);

// Verificaciones
router.get("/verifications", adminController.getVerifications);
router.get("/verifications/:id", validateRequest(uuidParam), adminController.getCompanyDetail);
router.patch("/verifications/:id/approve", validateRequest(uuidParam), adminController.approveVerification);
router.patch("/verifications/:id/reject", validateRequest(uuidParam), adminController.rejectVerification);

// Administradores
router.get("/administrators", adminController.getAdministrators);
router.post("/administrators", validateRequest(createAdminSchema), adminController.createAdministrator);

export default router;
