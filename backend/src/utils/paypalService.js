import { env } from "../config/environment.js";
import { logger } from "./logger.js";
import { AppError } from "./AppError.js";

/**
 * Obtiene la URL base de PayPal según el entorno configurado.
 */
const getBaseUrl = () => {
  return env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
};

// Caché en memoria del token de acceso de PayPal
let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Obtiene un token de acceso OAuth 2.0 desde PayPal.
 * @returns {Promise<string>} Bearer Access Token
 */
export const getAccessToken = async () => {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  const clientId = env.PAYPAL_CLIENT_ID;
  const clientSecret = env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret || clientId === "sb") {
    logger.warn("[PayPalService] Credenciales de PayPal no configuradas o en modo demo 'sb'.");
    throw new AppError(
      "Las credenciales de PayPal no están configuradas en el servidor. Por favor configura PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET en .env",
      500
    );
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const url = `${getBaseUrl()}/v1/oauth2/token`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    const data = await response.json();

    if (!response.ok) {
      logger.error({ data }, "[PayPalService] Error al obtener Access Token");
      throw new AppError(
        data.error_description || "Error al autenticarse con PayPal",
        response.status
      );
    }

    cachedToken = data.access_token;
    tokenExpiresAt = now + (data.expires_in || 3600) * 1000;
    return cachedToken;
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error({ err }, "[PayPalService] Fallo de red al conectar con PayPal");
    throw new AppError("Error de comunicación con los servidores de PayPal", 502);
  }
};

/**
 * Crea una orden de pago en PayPal (API Checkout v2).
 * @param {object} params
 * @param {number} params.amount
 * @param {string} [params.currency='USD']
 * @param {string} params.requestId
 * @param {string} [params.description]
 * @returns {Promise<{ orderId: string, approvalUrl: string }>}
 */
export const createOrder = async ({
  amount,
  currency = "USD",
  requestId,
  description = "Verificación ProveeLink",
}) => {
  const token = await getAccessToken();
  const url = `${getBaseUrl()}/v2/checkout/orders`;

  const body = {
    intent: "CAPTURE",
    purchase_units: [
      {
        custom_id: requestId,
        description: description.substring(0, 127),
        amount: {
          currency_code: currency,
          value: Number(amount).toFixed(2),
        },
      },
    ],
    application_context: {
      brand_name: "ProveeLink",
      landing_page: "NO_PREFERENCE",
      user_action: "PAY_NOW",
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    logger.error({ data }, "[PayPalService] Error al crear orden en PayPal");
    throw new AppError(
      data.message || "Error al crear la orden de pago en PayPal",
      response.status
    );
  }

  const approvalLink = data.links?.find((l) => l.rel === "approve");

  return {
    orderId: data.id,
    approvalUrl: approvalLink ? approvalLink.href : null,
  };
};

/**
 * Consulta el estado y detalle de una orden en PayPal.
 * @param {string} orderId
 * @returns {Promise<object>}
 */
export const getOrderDetails = async (orderId) => {
  const token = await getAccessToken();
  const url = `${getBaseUrl()}/v2/checkout/orders/${orderId}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();

  if (!response.ok) {
    logger.error({ data, orderId }, "[PayPalService] Error al consultar orden");
    throw new AppError(
      data.message || "Error al consultar la orden en PayPal",
      response.status
    );
  }

  return data;
};

/**
 * Captura una orden autorizada en PayPal.
 * @param {string} orderId
 * @returns {Promise<object>}
 */
export const captureOrder = async (orderId) => {
  const token = await getAccessToken();
  const url = `${getBaseUrl()}/v2/checkout/orders/${orderId}/capture`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();

  if (!response.ok) {
    logger.error({ data, orderId }, "[PayPalService] Error al capturar orden");
    throw new AppError(
      data.message || "Error al procesar la captura en PayPal",
      response.status
    );
  }

  return data;
};

/**
 * Verifica la firma del Webhook enviado por PayPal.
 * @param {object} params
 * @param {object} params.headers
 * @param {object} params.body
 * @returns {Promise<boolean>}
 */
export const verifyWebhookSignature = async ({ headers, body }) => {
  const webhookId = env.PAYPAL_WEBHOOK_ID;

  if (!webhookId) {
    logger.warn(
      "[PayPalService] PAYPAL_WEBHOOK_ID no configurado; no se puede verificar firma de webhook."
    );
    return false;
  }

  const token = await getAccessToken();
  const url = `${getBaseUrl()}/v1/notifications/verify-webhook-signature`;

  const verificationPayload = {
    auth_algo: headers["paypal-auth-algo"],
    cert_url: headers["paypal-cert-url"],
    transmission_id: headers["paypal-transmission-id"],
    transmission_sig: headers["paypal-transmission-sig"],
    transmission_time: headers["paypal-transmission-time"],
    webhook_id: webhookId,
    webhook_event: body,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(verificationPayload),
  });

  const data = await response.json();
  return data?.verification_status === "SUCCESS";
};
