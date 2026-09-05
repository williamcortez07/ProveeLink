import { query, pool } from "../../config/db.js";
import { logger } from "../../utils/logger.js";
import { AppError } from "../../utils/AppError.js";

// ─── PLANES ────────────────────────────────────────────────────────────────────

export const getActivePlans = async () => {
  try {
    const sql = `
      SELECT *
      FROM public.subscription_plans
      WHERE is_active = TRUE
      ORDER BY duration_months ASC;
    `;
    const result = await query(sql, []);
    return result.rows;
  } catch (err) {
    logger.error({ err }, "Error en getActivePlans");
    throw new AppError("Error al obtener los planes de suscripción", 500);
  }
};

export const getPlanById = async (planId) => {
  try {
    const sql = `
      SELECT *
      FROM public.subscription_plans
      WHERE id = $1;
    `;
    const result = await query(sql, [planId]);
    return result.rows[0] || null;
  } catch (err) {
    logger.error({ err, planId }, "Error en getPlanById");
    throw new AppError("Error al obtener el plan de suscripción", 500);
  }
};

// ─── SOLICITUDES DE VERIFICACIÓN ──────────────────────────────────────────────

export const createVerificationRequest = async ({
  supplier_id,
  business_description,
  business_address,
  contact_name,
  contact_phone,
}) => {
  try {
    const sql = `
      INSERT INTO public.verification_requests (
        supplier_id, business_description, business_address,
        contact_name, contact_phone
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const result = await query(sql, [
      supplier_id,
      business_description,
      business_address,
      contact_name ?? null,
      contact_phone ?? null,
    ]);
    return result.rows[0];
  } catch (err) {
    logger.error({ err, supplier_id }, "Error en createVerificationRequest");
    throw new AppError("Error al crear la solicitud de verificación", 500);
  }
};

/**
 * Busca la solicitud activa de un proveedor
 * (status NOT IN 'rejected', 'expired', 'cancelled')
 */
export const getVerificationRequestBySupplier = async (supplier_id) => {
  try {
    const sql = `
      SELECT *
      FROM public.verification_requests
      WHERE supplier_id = $1
        AND status NOT IN ('rejected', 'expired', 'cancelled')
      LIMIT 1;
    `;
    const result = await query(sql, [supplier_id]);
    return result.rows[0] || null;
  } catch (err) {
    logger.error({ err, supplier_id }, "Error en getVerificationRequestBySupplier");
    throw new AppError("Error al consultar la solicitud del proveedor", 500);
  }
};

export const getVerificationRequestById = async (id) => {
  try {
    const sql = `
      SELECT
        vr.*,
        json_agg(
          json_build_object(
            'id', ve.id,
            'evidence_type', ve.evidence_type,
            'file_url', ve.file_url,
            'file_name', ve.file_name,
            'display_order', ve.display_order,
            'created_at', ve.created_at
          ) ORDER BY ve.display_order ASC
        ) FILTER (WHERE ve.id IS NOT NULL) AS evidence
      FROM public.verification_requests vr
      LEFT JOIN public.verification_evidence ve ON ve.request_id = vr.id
      WHERE vr.id = $1
      GROUP BY vr.id;
    `;
    const result = await query(sql, [id]);
    return result.rows[0] || null;
  } catch (err) {
    logger.error({ err, id }, "Error en getVerificationRequestById");
    throw new AppError("Error al obtener la solicitud de verificación", 500);
  }
};

export const updateVerificationRequest = async (id, updateData) => {
  try {
    const fields = [];
    const values = [];
    let index = 1;

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${index}`);
        values.push(value);
        index += 1;
      }
    });

    if (fields.length === 0) {
      return getVerificationRequestById(id);
    }

    values.push(id);
    const sql = `
      UPDATE public.verification_requests
      SET ${fields.join(", ")}, updated_at = NOW()
      WHERE id = $${index}
      RETURNING *;
    `;
    const result = await query(sql, values);
    return result.rows[0] || null;
  } catch (err) {
    logger.error({ err, id, updateData }, "Error en updateVerificationRequest");
    throw new AppError("Error al actualizar la solicitud de verificación", 500);
  }
};

// ─── EVIDENCIAS ────────────────────────────────────────────────────────────────

export const getEvidenceByRequest = async (requestId) => {
  try {
    const sql = `
      SELECT *
      FROM public.verification_evidence
      WHERE request_id = $1
      ORDER BY display_order ASC;
    `;
    const result = await query(sql, [requestId]);
    return result.rows;
  } catch (err) {
    logger.error({ err, requestId }, "Error en getEvidenceByRequest");
    throw new AppError("Error al obtener las evidencias de la solicitud", 500);
  }
};

export const createEvidence = async ({
  request_id,
  evidence_type,
  file_url,
  file_name,
  display_order,
}) => {
  try {
    const sql = `
      INSERT INTO public.verification_evidence (
        request_id, evidence_type, file_url, file_name, display_order
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const result = await query(sql, [
      request_id,
      evidence_type ?? "photo",
      file_url,
      file_name ?? null,
      display_order ?? 0,
    ]);
    return result.rows[0];
  } catch (err) {
    logger.error({ err, request_id }, "Error en createEvidence");
    throw new AppError("Error al guardar la evidencia", 500);
  }
};

export const deleteEvidence = async (evidenceId, requestId) => {
  try {
    const sql = `
      DELETE FROM public.verification_evidence
      WHERE id = $1 AND request_id = $2
      RETURNING id;
    `;
    const result = await query(sql, [evidenceId, requestId]);
    return result.rows[0] || null;
  } catch (err) {
    logger.error({ err, evidenceId, requestId }, "Error en deleteEvidence");
    throw new AppError("Error al eliminar la evidencia", 500);
  }
};

// ─── SUSCRIPCIONES ─────────────────────────────────────────────────────────────

export const createSubscription = async ({
  supplier_id,
  request_id,
  plan_id,
  amount,
  currency,
}) => {
  try {
    const sql = `
      INSERT INTO public.subscriptions (
        supplier_id, request_id, plan_id, amount, currency, status
      )
      VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING *;
    `;
    const result = await query(sql, [
      supplier_id,
      request_id,
      plan_id,
      amount,
      currency ?? "USD",
    ]);
    return result.rows[0];
  } catch (err) {
    logger.error({ err, request_id }, "Error en createSubscription");
    throw new AppError("Error al crear la suscripción", 500);
  }
};

export const getSubscriptionByRequest = async (requestId) => {
  try {
    const sql = `
      SELECT s.*, sp.duration_months, sp.name AS plan_name
      FROM public.subscriptions s
      JOIN public.subscription_plans sp ON sp.id = s.plan_id
      WHERE s.request_id = $1
      LIMIT 1;
    `;
    const result = await query(sql, [requestId]);
    return result.rows[0] || null;
  } catch (err) {
    logger.error({ err, requestId }, "Error en getSubscriptionByRequest");
    throw new AppError("Error al obtener la suscripción de la solicitud", 500);
  }
};

// ─── PAGOS ─────────────────────────────────────────────────────────────────────

export const createPayment = async ({
  subscription_id,
  supplier_id,
  amount,
  currency,
  payment_method,
  paypal_order_id,
}) => {
  try {
    const sql = `
      INSERT INTO public.payments (
        subscription_id, supplier_id, amount, currency,
        payment_method, paypal_order_id, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      RETURNING *;
    `;
    const result = await query(sql, [
      subscription_id,
      supplier_id,
      amount,
      currency ?? "USD",
      payment_method ?? "paypal",
      paypal_order_id ?? null,
    ]);
    return result.rows[0];
  } catch (err) {
    logger.error({ err, subscription_id }, "Error en createPayment");
    throw new AppError("Error al registrar el pago", 500);
  }
};

export const getPaymentByOrderId = async (paypalOrderId) => {
  try {
    const sql = `
      SELECT *
      FROM public.payments
      WHERE paypal_order_id = $1
      LIMIT 1;
    `;
    const result = await query(sql, [paypalOrderId]);
    return result.rows[0] || null;
  } catch (err) {
    logger.error({ err, paypalOrderId }, "Error en getPaymentByOrderId");
    throw new AppError("Error al obtener el pago por order ID", 500);
  }
};

export const updatePaymentByOrderId = async (paypalOrderId, updateData) => {
  try {
    const fields = [];
    const values = [];
    let index = 1;

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${index}`);
        values.push(value);
        index += 1;
      }
    });

    if (fields.length === 0) return null;

    values.push(paypalOrderId);
    const sql = `
      UPDATE public.payments
      SET ${fields.join(", ")}, updated_at = NOW()
      WHERE paypal_order_id = $${index}
      RETURNING *;
    `;
    const result = await query(sql, values);
    return result.rows[0] || null;
  } catch (err) {
    logger.error({ err, paypalOrderId, updateData }, "Error en updatePaymentByOrderId");
    throw new AppError("Error al actualizar el pago", 500);
  }
};

// ─── ADMIN ─────────────────────────────────────────────────────────────────────

export const getAllRequestsAdmin = async ({
  limit = 10,
  offset = 0,
  status,
  search,
}) => {
  try {
    const params = [];
    const conditions = [];

    if (status) {
      params.push(status);
      conditions.push(`vr.status = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      conditions.push(
        `(c.name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR vr.contact_name ILIKE $${params.length})`
      );
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    params.push(limit, offset);
    const sql = `
      SELECT
        vr.id,
        vr.status,
        vr.submitted_at,
        vr.created_at,
        vr.updated_at,
        vr.contact_name,
        vr.contact_phone,
        s.id AS supplier_id,
        c.id AS company_id,
        c.name AS company_name,
        c.verification_status AS company_verification_status,
        u.id AS user_id,
        u.email AS user_email,
        u.first_name,
        u.last_name,
        COUNT(*) OVER() AS total_count
      FROM public.verification_requests vr
      JOIN public.suppliers s ON s.id = vr.supplier_id
      JOIN public.companies c ON c.id = s.company_id
      JOIN public.users u ON u.id = c.user_id
      ${whereClause}
      ORDER BY vr.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length};
    `;
    const result = await query(sql, params);
    const total =
      result.rows.length > 0 ? Number(result.rows[0].total_count) : 0;
    const data = result.rows.map(({ total_count, ...row }) => row);
    return { data, total };
  } catch (err) {
    logger.error({ err, limit, offset, status, search }, "Error en getAllRequestsAdmin");
    throw new AppError("Error al obtener las solicitudes de verificación", 500);
  }
};

export const getRequestDetailAdmin = async (id) => {
  try {
    const sql = `
      SELECT
        vr.*,
        s.id AS supplier_id,
        s.supplier_type,
        c.id AS company_id,
        c.name AS company_name,
        c.verification_status AS company_verification_status,
        u.id AS user_id,
        u.email AS user_email,
        u.first_name,
        u.last_name,
        u.phone AS user_phone,
        json_agg(
          DISTINCT jsonb_build_object(
            'id', ve.id,
            'evidence_type', ve.evidence_type,
            'file_url', ve.file_url,
            'file_name', ve.file_name,
            'display_order', ve.display_order,
            'created_at', ve.created_at
          )
        ) FILTER (WHERE ve.id IS NOT NULL) AS evidence,
        row_to_json(sub.*) AS subscription,
        row_to_json(pay.*) AS payment
      FROM public.verification_requests vr
      JOIN public.suppliers s ON s.id = vr.supplier_id
      JOIN public.companies c ON c.id = s.company_id
      JOIN public.users u ON u.id = c.user_id
      LEFT JOIN public.verification_evidence ve ON ve.request_id = vr.id
      LEFT JOIN public.subscriptions sub ON sub.request_id = vr.id
      LEFT JOIN public.payments pay ON pay.subscription_id = sub.id
      WHERE vr.id = $1
      GROUP BY vr.id, s.id, s.supplier_type, c.id, c.name, c.verification_status,
               u.id, u.email, u.first_name, u.last_name, u.phone, sub.*, pay.*;
    `;
    const result = await query(sql, [id]);
    return result.rows[0] || null;
  } catch (err) {
    logger.error({ err, id }, "Error en getRequestDetailAdmin");
    throw new AppError("Error al obtener el detalle de la solicitud", 500);
  }
};

export const approveRequest = async (requestId, reviewedBy) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Aprobar la solicitud
    const updateReqResult = await client.query(
      `UPDATE public.verification_requests
       SET status = 'approved',
           approved_at = NOW(),
           reviewed_at = NOW(),
           reviewed_by = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *;`,
      [reviewedBy, requestId]
    );
    const updatedRequest = updateReqResult.rows[0];
    if (!updatedRequest) throw new AppError("Solicitud no encontrada", 404);

    // 2. Activar la suscripción y calcular fechas
    await client.query(
      `UPDATE public.subscriptions
       SET status = 'active',
           start_date = CURRENT_DATE,
           end_date = CURRENT_DATE + (
             SELECT (duration_months || ' months')::interval
             FROM public.subscription_plans
             WHERE id = subscriptions.plan_id
           ),
           updated_at = NOW()
       WHERE request_id = $1;`,
      [requestId]
    );

    // 3. Verificar la empresa del proveedor
    await client.query(
      `UPDATE public.companies
       SET verification_status = 'verified'
       WHERE id = (
         SELECT company_id FROM public.suppliers WHERE id = $1
       );`,
      [updatedRequest.supplier_id]
    );

    await client.query("COMMIT");
    return updatedRequest;
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err, requestId, reviewedBy }, "Error en approveRequest (transacción)");
    if (err instanceof AppError) throw err;
    throw new AppError("Error al aprobar la solicitud de verificación", 500);
  } finally {
    client.release();
  }
};

export const rejectRequest = async (requestId, reviewedBy, rejectionReason) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Rechazar la solicitud
    const updateReqResult = await client.query(
      `UPDATE public.verification_requests
       SET status = 'rejected',
           rejection_reason = $1,
           rejected_at = NOW(),
           reviewed_at = NOW(),
           reviewed_by = $2,
           updated_at = NOW()
       WHERE id = $3
       RETURNING *;`,
      [rejectionReason, reviewedBy, requestId]
    );
    const updatedRequest = updateReqResult.rows[0];
    if (!updatedRequest) throw new AppError("Solicitud no encontrada", 404);

    // 2. Actualizar estado de la empresa
    await client.query(
      `UPDATE public.companies
       SET verification_status = 'rejected'
       WHERE id = (
         SELECT company_id FROM public.suppliers WHERE id = $1
       );`,
      [updatedRequest.supplier_id]
    );

    await client.query("COMMIT");
    return updatedRequest;
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err, requestId, reviewedBy }, "Error en rejectRequest (transacción)");
    if (err instanceof AppError) throw err;
    throw new AppError("Error al rechazar la solicitud de verificación", 500);
  } finally {
    client.release();
  }
};

export const expireSubscriptions = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Expirar suscripciones vencidas
    const expiredResult = await client.query(
      `UPDATE public.subscriptions
       SET status = 'expired', updated_at = NOW()
       WHERE status = 'active' AND end_date < CURRENT_DATE
       RETURNING id, supplier_id;`
    );

    const expiredRows = expiredResult.rows;

    // 2. Revocar verificación de las empresas afectadas
    if (expiredRows.length > 0) {
      const supplierIds = expiredRows.map((r) => r.supplier_id);
      for (const supplierId of supplierIds) {
        await client.query(
          `UPDATE public.companies
           SET verification_status = 'pending'
           WHERE id = (SELECT company_id FROM public.suppliers WHERE id = $1);`,
          [supplierId]
        );
      }
    }

    await client.query("COMMIT");
    return expiredRows.length;
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "Error en expireSubscriptions (transacción)");
    throw new AppError("Error al expirar las suscripciones", 500);
  } finally {
    client.release();
  }
};
