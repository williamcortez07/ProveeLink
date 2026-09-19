import { Router } from "express";
import * as verificationController from "./verificationController.js";
import { authenticate, authorize } from "../../middlewares/auth.middlewares.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import {
  createRequestSchema,
  updateRequestSchema,
  selectPlanSchema,
  rejectRequestSchema,
  requestIdParam,
  addEvidenceSchema,
  removeEvidenceSchema,
  adminGetRequestsSchema,
} from "./verificationSchema.js";

const router = Router();

// ─── PÚBLICAS ────────────────────────────────────────────────────────────────
// Configuración pública (Client ID de PayPal, modo sandbox/live)
router.get("/config", verificationController.getPublicConfig);

// Planes de suscripción disponibles
router.get("/plans", verificationController.getPlans);

// Webhook de PayPal (sin JWT, validación por firma criptográfica)
router.post("/webhook", verificationController.handleWebhook);

// ─── PROVEEDOR (requiere login + rol 'Proveedor') ─────────────────────────────
// Nota: el nombre del rol viene exactamente como está en la tabla public.roles
// de Neon: "Proveedor" (con mayúscula, en español). El middleware authorize()
// convierte a MAYÚSCULAS antes de comparar, por lo que el match es case-insensitive.
router.get(
  "/requests/me",
  authenticate,
  authorize("Proveedor"),
  verificationController.getMyRequest
);

router.post(
  "/requests",
  authenticate,
  authorize("Proveedor"),
  validateRequest(createRequestSchema),
  verificationController.createRequest
);

router.put(
  "/requests/:id",
  authenticate,
  authorize("Proveedor"),
  validateRequest(updateRequestSchema),
  verificationController.updateRequest
);

router.post(
  "/requests/:id/evidence",
  authenticate,
  authorize("Proveedor"),
  validateRequest(addEvidenceSchema),
  verificationController.addEvidence
);

router.delete(
  "/requests/:id/evidence/:evidenceId",
  authenticate,
  authorize("Proveedor"),
  validateRequest(removeEvidenceSchema),
  verificationController.removeEvidence
);

router.post(
  "/requests/:id/subscription",
  authenticate,
  authorize("Proveedor"),
  validateRequest(selectPlanSchema),
  verificationController.selectPlan
);

router.post(
  "/requests/:id/payment",
  authenticate,
  authorize("Proveedor"),
  verificationController.confirmPayment
);

// ─── ADMIN (requiere login + rol 'Admin') ─────────────────────────────────────
router.get(
  "/admin/requests",
  authenticate,
  authorize("Admin"),
  validateRequest(adminGetRequestsSchema),
  verificationController.adminGetRequests
);

router.get(
  "/admin/requests/:id",
  authenticate,
  authorize("Admin"),
  validateRequest(requestIdParam),
  verificationController.adminGetRequestDetail
);

router.patch(
  "/admin/requests/:id/approve",
  authenticate,
  authorize("Admin"),
  validateRequest(requestIdParam),
  verificationController.adminApproveRequest
);

router.patch(
  "/admin/requests/:id/reject",
  authenticate,
  authorize("Admin"),
  validateRequest(rejectRequestSchema),
  verificationController.adminRejectRequest
);

export default router;
