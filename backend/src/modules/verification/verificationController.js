import { asyncWrapper } from "../../utils/asyncWrapper.js";
import { AppError } from "../../utils/AppError.js";
import { query } from "../../config/db.js";
import { logger } from "../../utils/logger.js";
import * as verificationService from "./verificationService.js";
import * as paypalService from "../../utils/paypalService.js";

// ─── Helper: obtener supplier por user_id ──────────────────────────────────────

const getSupplierByUserId = async (userId) => {
  const sql = `
    SELECT s.id, s.supplier_type, s.status
    FROM public.suppliers s
    JOIN public.companies c ON c.id = s.company_id
    WHERE c.user_id = $1
    LIMIT 1;
  `;
  const result = await query(sql, [userId]);
  return result.rows[0] || null;
};

// ─── PLANES ────────────────────────────────────────────────────────────────────

export const getPlans = asyncWrapper(async (req, res) => {
  const plans = await verificationService.getPlans();
  res.status(200).json({
    success: true,
    message: "Planes de suscripción obtenidos exitosamente",
    data: plans,
  });
});

// ─── SOLICITUDES (PROVEEDOR) ───────────────────────────────────────────────────

export const createRequest = asyncWrapper(async (req, res) => {
  const supplier = await getSupplierByUserId(req.user.id);
  if (!supplier) {
    throw new AppError(
      "No se encontró un perfil de proveedor asociado a tu cuenta",
      404
    );
  }
  const request = await verificationService.createRequest(supplier.id, req.body);
  res.status(201).json({
    success: true,
    message: "Solicitud de verificación creada exitosamente",
    data: request,
  });
});

export const getMyRequest = asyncWrapper(async (req, res) => {
  const supplier = await getSupplierByUserId(req.user.id);
  if (!supplier) {
    throw new AppError(
      "No se encontró un perfil de proveedor asociado a tu cuenta",
      404
    );
  }
  const requestData = await verificationService.getMyRequest(supplier.id);
  res.status(200).json({
    success: true,
    message: "Solicitud de verificación obtenida exitosamente",
    data: requestData,
  });
});

export const updateRequest = asyncWrapper(async (req, res) => {
  const supplier = await getSupplierByUserId(req.user.id);
  if (!supplier) {
    throw new AppError(
      "No se encontró un perfil de proveedor asociado a tu cuenta",
      404
    );
  }
  const updated = await verificationService.updateRequest(
    req.params.id,
    supplier.id,
    req.body
  );
  res.status(200).json({
    success: true,
    message: "Solicitud de verificación actualizada exitosamente",
    data: updated,
  });
});

export const addEvidence = asyncWrapper(async (req, res) => {
  const supplier = await getSupplierByUserId(req.user.id);
  if (!supplier) {
    throw new AppError(
      "No se encontró un perfil de proveedor asociado a tu cuenta",
      404
    );
  }
  const evidence = await verificationService.addEvidence(
    req.params.id,
    supplier.id,
    req.body
  );
  res.status(201).json({
    success: true,
    message: "Evidencia agregada exitosamente",
    data: evidence,
  });
});

export const removeEvidence = asyncWrapper(async (req, res) => {
  const supplier = await getSupplierByUserId(req.user.id);
  if (!supplier) {
    throw new AppError(
      "No se encontró un perfil de proveedor asociado a tu cuenta",
      404
    );
  }
  await verificationService.removeEvidence(
    req.params.id,
    req.params.evidenceId,
    supplier.id
  );
  res.status(200).json({
    success: true,
    message: "Evidencia eliminada exitosamente",
    data: null,
  });
});

export const selectPlan = asyncWrapper(async (req, res) => {
  const supplier = await getSupplierByUserId(req.user.id);
  if (!supplier) {
    throw new AppError(
      "No se encontró un perfil de proveedor asociado a tu cuenta",
      404
    );
  }
  const result = await verificationService.selectPlan(
    req.params.id,
    supplier.id,
    req.body.plan_id
  );
  res.status(200).json({
    success: true,
    message: "Plan seleccionado exitosamente. Procede al pago.",
    data: result,
  });
});

export const initiatePayment = asyncWrapper(async (req, res) => {
  const supplier = await getSupplierByUserId(req.user.id);
  if (!supplier) {
    throw new AppError(
      "No se encontró un perfil de proveedor asociado a tu cuenta",
      404
    );
  }
  const result = await verificationService.initiatePayment(
    req.params.id,
    supplier.id,
    paypalService
  );
  res.status(200).json({
    success: true,
    message: "Orden de pago creada exitosamente",
    data: result,
  });
});

// ─── WEBHOOK (SIN AUTENTICACIÓN) ──────────────────────────────────────────────

export const handleWebhook = asyncWrapper(async (req, res) => {
  // Verificar firma de PayPal
  let isValid = false;
  try {
    isValid = await paypalService.verifyWebhookSignature({
      headers: req.headers,
      body: req.body,
    });
  } catch (err) {
    logger.warn({ err }, "Error al verificar firma del webhook PayPal");
  }

  if (!isValid) {
    logger.warn("Webhook PayPal con firma inválida rechazado");
    return res.status(400).json({
      success: false,
      message: "Firma del webhook inválida",
      data: null,
    });
  }

  // Siempre responder 200 para que PayPal no reintente (procesamos en background)
  res.status(200).json({ success: true, message: "Webhook recibido", data: null });

  // Procesar el evento de forma asíncrona
  verificationService.handleWebhook(req.body, paypalService).catch((err) => {
    logger.error({ err }, "Error al procesar el webhook de PayPal");
  });
});

// ─── ADMIN ─────────────────────────────────────────────────────────────────────

export const adminGetRequests = asyncWrapper(async (req, res) => {
  const { page, pageSize, status, search } = req.query;
  const result = await verificationService.adminGetRequests({
    page,
    pageSize,
    status,
    search,
  });
  res.status(200).json({
    success: true,
    message: "Solicitudes de verificación obtenidas exitosamente",
    data: result.data,
    pagination: result.pagination,
  });
});

export const adminGetRequestDetail = asyncWrapper(async (req, res) => {
  const detail = await verificationService.adminGetRequestDetail(req.params.id);
  res.status(200).json({
    success: true,
    message: "Detalle de la solicitud obtenido exitosamente",
    data: detail,
  });
});

export const adminApproveRequest = asyncWrapper(async (req, res) => {
  const updated = await verificationService.approveRequest(
    req.params.id,
    req.user.id
  );
  res.status(200).json({
    success: true,
    message: "Solicitud aprobada exitosamente. El proveedor ha sido verificado.",
    data: updated,
  });
});

export const adminRejectRequest = asyncWrapper(async (req, res) => {
  const updated = await verificationService.rejectRequest(
    req.params.id,
    req.user.id,
    req.body.rejection_reason
  );
  res.status(200).json({
    success: true,
    message: "Solicitud rechazada exitosamente.",
    data: updated,
  });
});
