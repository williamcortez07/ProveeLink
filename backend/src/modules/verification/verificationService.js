import { AppError } from "../../utils/AppError.js";
import { logger } from "../../utils/logger.js";
import * as repo from "./verificationRepository.js";
import { sendVerificationResultEmail } from "../../utils/mailer.js";

// ─── PLANES ────────────────────────────────────────────────────────────────────

export const getPlans = async () => {
  const plans = await repo.getActivePlans();
  return plans;
};

// ─── SOLICITUDES ───────────────────────────────────────────────────────────────

export const createRequest = async (supplierId, data) => {
  // Verificar que no tenga solicitud activa
  const existing = await repo.getVerificationRequestBySupplier(supplierId);
  if (existing) {
    throw new AppError(
      "Ya tienes una solicitud de verificación activa. No puedes crear otra hasta que la actual finalice.",
      409
    );
  }
  const request = await repo.createVerificationRequest({
    supplier_id: supplierId,
    ...data,
  });
  return request;
};

export const getMyRequest = async (supplierId) => {
  const request = await repo.getVerificationRequestBySupplier(supplierId);
  if (!request) {
    throw new AppError("No tienes ninguna solicitud de verificación activa", 404);
  }
  const [evidence, subscription] = await Promise.all([
    repo.getEvidenceByRequest(request.id),
    repo.getSubscriptionByRequest(request.id),
  ]);
  return { ...request, evidence, subscription };
};

export const updateRequest = async (requestId, supplierId, data) => {
  const request = await repo.getVerificationRequestById(requestId);
  if (!request) {
    throw new AppError("Solicitud de verificación no encontrada", 404);
  }
  if (request.supplier_id !== supplierId) {
    throw new AppError("No tienes permiso para modificar esta solicitud", 403);
  }
  if (request.status !== "draft") {
    throw new AppError(
      "Solo puedes modificar solicitudes en estado borrador (draft)",
      400
    );
  }
  return repo.updateVerificationRequest(requestId, data);
};

// ─── EVIDENCIAS ────────────────────────────────────────────────────────────────

export const addEvidence = async (requestId, supplierId, evidenceData) => {
  const request = await repo.getVerificationRequestById(requestId);
  if (!request) {
    throw new AppError("Solicitud de verificación no encontrada", 404);
  }
  if (request.supplier_id !== supplierId) {
    throw new AppError("No tienes permiso para modificar esta solicitud", 403);
  }
  if (request.status !== "draft") {
    throw new AppError(
      "Solo puedes agregar evidencias a solicitudes en estado borrador (draft)",
      400
    );
  }

  const currentEvidence = await repo.getEvidenceByRequest(requestId);
  if (currentEvidence.length >= 10) {
    throw new AppError(
      "Has alcanzado el máximo de 10 evidencias por solicitud",
      400
    );
  }

  return repo.createEvidence({ request_id: requestId, ...evidenceData });
};

export const removeEvidence = async (requestId, evidenceId, supplierId) => {
  const request = await repo.getVerificationRequestById(requestId);
  if (!request) {
    throw new AppError("Solicitud de verificación no encontrada", 404);
  }
  if (request.supplier_id !== supplierId) {
    throw new AppError("No tienes permiso para modificar esta solicitud", 403);
  }
  if (request.status !== "draft") {
    throw new AppError(
      "Solo puedes eliminar evidencias de solicitudes en estado borrador (draft)",
      400
    );
  }

  const deleted = await repo.deleteEvidence(evidenceId, requestId);
  if (!deleted) {
    throw new AppError("Evidencia no encontrada", 404);
  }
  return deleted;
};

// ─── SELECCIÓN DE PLAN ─────────────────────────────────────────────────────────

export const selectPlan = async (requestId, supplierId, planId) => {
  const request = await repo.getVerificationRequestById(requestId);
  if (!request) {
    throw new AppError("Solicitud de verificación no encontrada", 404);
  }
  if (request.supplier_id !== supplierId) {
    throw new AppError("No tienes permiso para modificar esta solicitud", 403);
  }
  if (request.status !== "draft") {
    throw new AppError(
      "Solo puedes seleccionar plan en solicitudes en estado borrador (draft)",
      400
    );
  }

  const plan = await repo.getPlanById(planId);
  if (!plan) {
    throw new AppError("Plan de suscripción no encontrado", 404);
  }
  if (!plan.is_active) {
    throw new AppError("El plan seleccionado no está disponible actualmente", 400);
  }

  // Crear suscripción pendiente
  const subscription = await repo.createSubscription({
    supplier_id: supplierId,
    request_id: requestId,
    plan_id: planId,
    amount: plan.final_price,
    currency: plan.currency,
  });

  // Avanzar la solicitud a pending_payment
  const updatedRequest = await repo.updateVerificationRequest(requestId, {
    status: "pending_payment",
    submitted_at: new Date().toISOString(),
  });

  return { request: updatedRequest, subscription, plan };
};

// ─── PAGO ──────────────────────────────────────────────────────────────────────

export const initiatePayment = async (requestId, supplierId, paypalService) => {
  const request = await repo.getVerificationRequestById(requestId);
  if (!request) {
    throw new AppError("Solicitud de verificación no encontrada", 404);
  }
  if (request.supplier_id !== supplierId) {
    throw new AppError("No tienes permiso para gestionar esta solicitud", 403);
  }
  if (request.status !== "pending_payment") {
    throw new AppError(
      "La solicitud debe estar en estado 'pending_payment' para iniciar el pago",
      400
    );
  }

  const subscription = await repo.getSubscriptionByRequest(requestId);
  if (!subscription) {
    throw new AppError("No hay suscripción asociada a esta solicitud", 404);
  }

  // Crear orden en PayPal
  const { orderId, approvalUrl } = await paypalService.createOrder({
    amount: Number(subscription.amount),
    currency: subscription.currency,
    requestId,
    description: `Verificación ProveeLink - ${subscription.plan_name || "Plan"}`,
  });

  // Registrar el pago pendiente
  await repo.createPayment({
    subscription_id: subscription.id,
    supplier_id: supplierId,
    amount: Number(subscription.amount),
    currency: subscription.currency,
    payment_method: "paypal",
    paypal_order_id: orderId,
  });

  return { payment_url: approvalUrl, paypal_order_id: orderId };
};

// ─── WEBHOOK ───────────────────────────────────────────────────────────────────

export const handleWebhook = async (event, paypalService) => {
  const eventType = event?.event_type;
  logger.info({ eventType }, "Webhook PayPal recibido");

  if (eventType !== "PAYMENT.CAPTURE.COMPLETED") {
    logger.info({ eventType }, "Webhook ignorado: tipo de evento no procesado");
    return;
  }

  const orderId =
    event?.resource?.supplementary_data?.related_ids?.order_id ||
    event?.resource?.id;

  if (!orderId) {
    logger.warn({ event }, "Webhook sin orderId, ignorado");
    return;
  }

  const payment = await repo.getPaymentByOrderId(orderId);
  if (!payment) {
    logger.warn({ orderId }, "Pago no encontrado para el orderId del webhook");
    return;
  }

  if (payment.webhook_verified) {
    logger.info({ orderId }, "Webhook ya procesado anteriormente, ignorado");
    return;
  }

  // Obtener la suscripción para verificar el monto
  const { pool: _pool, query: dbQuery } = await import("../../config/db.js");
  const subResult = await dbQuery(
    "SELECT s.*, sp.final_price FROM public.subscriptions s JOIN public.subscription_plans sp ON sp.id = s.plan_id WHERE s.id = $1",
    [payment.subscription_id]
  );
  const subscription = subResult.rows[0];

  if (!subscription) {
    logger.warn({ subscription_id: payment.subscription_id }, "Suscripción no encontrada en webhook");
    return;
  }

  // Verificar que el monto pagado coincida con el plan
  const paidAmount = Number(
    event?.resource?.amount?.value || payment.amount
  );
  const expectedAmount = Number(subscription.final_price);

  if (Math.abs(paidAmount - expectedAmount) > 0.01) {
    logger.warn(
      { paidAmount, expectedAmount, orderId },
      "Monto del webhook no coincide con el plan"
    );
    return;
  }

  // Actualizar el pago
  await repo.updatePaymentByOrderId(orderId, {
    status: "completed",
    webhook_verified: true,
    paid_at: new Date().toISOString(),
    gateway_response: event,
  });

  // Avanzar la solicitud a pending_review
  await repo.updateVerificationRequest(subscription.request_id, {
    status: "pending_review",
  });

  // Activar la suscripción
  await dbQuery(
    `UPDATE public.subscriptions SET status = 'active', updated_at = NOW() WHERE id = $1`,
    [subscription.id]
  );

  logger.info({ orderId, requestId: subscription.request_id }, "Pago confirmado por webhook, solicitud en revisión");
};

// ─── ADMIN ─────────────────────────────────────────────────────────────────────

export const adminGetRequests = async ({ page = 1, pageSize = 10, status, search }) => {
  const limit = pageSize;
  const offset = (page - 1) * limit;
  const { data, total } = await repo.getAllRequestsAdmin({
    limit,
    offset,
    status,
    search,
  });
  return {
    data,
    pagination: {
      page,
      pageSize,
      totalItems: total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
};

export const adminGetRequestDetail = async (id) => {
  const detail = await repo.getRequestDetailAdmin(id);
  if (!detail) {
    throw new AppError("Solicitud de verificación no encontrada", 404);
  }
  return detail;
};

export const approveRequest = async (requestId, adminUserId) => {
  const request = await repo.getVerificationRequestById(requestId);
  if (!request) {
    throw new AppError("Solicitud de verificación no encontrada", 404);
  }
  if (request.status !== "pending_review") {
    throw new AppError(
      "Solo se pueden aprobar solicitudes en estado 'pending_review'",
      400
    );
  }

  const updatedRequest = await repo.approveRequest(requestId, adminUserId);

  // Enviar email de notificación al proveedor
  try {
    // Obtener email del proveedor
    const { query: dbQuery } = await import("../../config/db.js");
    const userResult = await dbQuery(
      `SELECT u.email, u.first_name
       FROM public.users u
       JOIN public.companies c ON c.user_id = u.id
       JOIN public.suppliers s ON s.company_id = c.id
       WHERE s.id = $1
       LIMIT 1;`,
      [updatedRequest.supplier_id]
    );
    const user = userResult.rows[0];
    if (user) {
      await sendVerificationResultEmail(user.email, user.first_name, "approved");
    }
  } catch (emailErr) {
    logger.warn({ emailErr, requestId }, "Error al enviar email de aprobación, continuando...");
  }

  return updatedRequest;
};

export const rejectRequest = async (requestId, adminUserId, reason) => {
  const request = await repo.getVerificationRequestById(requestId);
  if (!request) {
    throw new AppError("Solicitud de verificación no encontrada", 404);
  }
  if (!["pending_review", "pending_payment", "draft"].includes(request.status)) {
    throw new AppError(
      "No se puede rechazar una solicitud en este estado",
      400
    );
  }

  const updatedRequest = await repo.rejectRequest(requestId, adminUserId, reason);

  // Enviar email de notificación al proveedor
  try {
    const { query: dbQuery } = await import("../../config/db.js");
    const userResult = await dbQuery(
      `SELECT u.email, u.first_name
       FROM public.users u
       JOIN public.companies c ON c.user_id = u.id
       JOIN public.suppliers s ON s.company_id = c.id
       WHERE s.id = $1
       LIMIT 1;`,
      [updatedRequest.supplier_id]
    );
    const user = userResult.rows[0];
    if (user) {
      await sendVerificationResultEmail(user.email, user.first_name, "rejected", reason);
    }
  } catch (emailErr) {
    logger.warn({ emailErr, requestId }, "Error al enviar email de rechazo, continuando...");
  }

  return updatedRequest;
};
