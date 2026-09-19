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

// ─── PROVEEDOR (requiere login + rol 'supplier') ──────────────────────────────
router.get(
  "/requests/me",
  authenticate,
  authorize("supplier"),
  verificationController.getMyRequest
);

router.post(
  "/requests",
  authenticate,
  authorize("supplier"),
  validateRequest(createRequestSchema),
  verificationController.createRequest
);

router.put(
  "/requests/:id",
  authenticate,
  authorize("supplier"),
  validateRequest(updateRequestSchema),
  verificationController.updateRequest
);

router.post(
  "/requests/:id/evidence",
  authenticate,
  authorize("supplier"),
  validateRequest(addEvidenceSchema),
  verificationController.addEvidence
);

router.delete(
  "/requests/:id/evidence/:evidenceId",
  authenticate,
  authorize("supplier"),
  validateRequest(removeEvidenceSchema),
  verificationController.removeEvidence
);

router.post(
  "/requests/:id/subscription",
  authenticate,
  authorize("supplier"),
  validateRequest(selectPlanSchema),
  verificationController.selectPlan
);

router.post(
  "/requests/:id/payment",
  authenticate,
  authorize("supplier"),
  verificationController.confirmPayment
);

// ─── ADMIN (requiere login + rol 'admin') ─────────────────────────────────────
router.get(
  "/admin/requests",
  authenticate,
  authorize("admin"),
  validateRequest(adminGetRequestsSchema),
  verificationController.adminGetRequests
);

router.get(
  "/admin/requests/:id",
  authenticate,
  authorize("admin"),
  validateRequest(requestIdParam),
  verificationController.adminGetRequestDetail
);

router.patch(
  "/admin/requests/:id/approve",
  authenticate,
  authorize("admin"),
  validateRequest(requestIdParam),
  verificationController.adminApproveRequest
);

router.patch(
  "/admin/requests/:id/reject",
  authenticate,
  authorize("admin"),
  validateRequest(rejectRequestSchema),
  verificationController.adminRejectRequest
);

export default router;
