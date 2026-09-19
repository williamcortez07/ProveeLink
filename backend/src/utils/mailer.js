import { env } from "../config/environment.js";
import { logger } from "./logger.js";
import { AppError } from "./AppError.js";
  
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

/**
 * Envía el código OTP de verificación por correo electrónico via Brevo API.
 * Usa HTTPS (puerto 443) — compatible con Render y cualquier plataforma cloud.
 * No requiere dominio propio: solo verificar el email remitente en brevo.com.
 *
 * @param {string} toEmail   Destinatario
 * @param {string} otpCode   Código OTP en texto plano (6 dígitos)
 * @returns {Promise<void>}
 */
export const sendOtpEmail = async (toEmail, otpCode) => {
  const body = {
    sender: { name: "ProveeLink", email: env.MAIL_FROM },
    to: [{ email: toEmail }],
    subject: "Tu código de verificación — ProveeLink",
    textContent: `Tu código de verificación es: ${otpCode}\n\nEste código expira en 15 minutos.\nSi no solicitaste esto, ignora este mensaje.`,
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 32px; border: 1px solid #e5e7eb; border-radius: 8px;">
        <h2 style="color: #1d4ed8; margin-bottom: 8px;">Verificación de correo</h2>
        <p style="color: #374151; font-size: 15px;">Usa el siguiente código para verificar tu cuenta en <strong>ProveeLink</strong>:</p>
        <div style="background: #f3f4f6; border-radius: 6px; padding: 20px 0; text-align: center; margin: 24px 0;">
          <span style="font-size: 36px; font-weight: 700; letter-spacing: 10px; color: #1d4ed8;">${otpCode}</span>
        </div>
        <p style="color: #6b7280; font-size: 13px;">⏱ Este código expira en <strong>15 minutos</strong>.</p>
        <p style="color: #6b7280; font-size: 13px;">Si no solicitaste este código, puedes ignorar este mensaje de forma segura.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 11px; text-align: center;">© ${new Date().getFullYear()} ProveeLink. Todos los derechos reservados.</p>
      </div>
    `,
  };

  let res;
  try {
    res = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": env.BREVO_API_KEY,
      },
      body: JSON.stringify(body),
    });
  } catch (networkErr) {
    logger.error({ error: networkErr.message, to: toEmail }, "Error de red al contactar Brevo");
    throw new AppError("Error de red al enviar correo. Intenta de nuevo.", 503);
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    logger.error({ status: res.status, brevo_error: errorBody, to: toEmail }, "Error Brevo al enviar OTP");
    throw new AppError(`Error al enviar correo: ${errorBody.message ?? res.statusText}`, 503);
  }

  const data = await res.json();
  logger.info({ to: toEmail, messageId: data?.messageId }, "OTP enviado por correo via Brevo");
};

/**
 * Envía el correo de resultado de la verificación (aprobado o rechazado).
 * @param {string} toEmail
 * @param {string} firstName
 * @param {'approved'|'rejected'} status
 * @param {string} [rejectionReason]
 * @returns {Promise<void>}
 */
export const sendVerificationResultEmail = async (
  toEmail,
  firstName,
  status,
  rejectionReason = ""
) => {
  const isApproved = status === "approved";
  const subject = isApproved
    ? "¡Felicidades! Tu cuenta de proveedor ha sido verificada — ProveeLink"
    : "Actualización sobre tu solicitud de verificación — ProveeLink";

  const contentHtml = isApproved
    ? `
      <h2 style="color: #16a34a; margin-bottom: 8px;">¡Tu empresa ha sido verificada!</h2>
      <p style="color: #374151; font-size: 15px;">Hola <strong>${firstName || "Proveedor"}</strong>,</p>
      <p style="color: #374151; font-size: 15px;">Nos complace informarte que tu solicitud de verificación ha sido aprobada exitosamente por nuestro equipo administrativo.</p>
      <p style="color: #374151; font-size: 15px;">Ya cuentas con la insignia oficial de <strong>Proveedor Verificado</strong> y tu suscripción está activa con todos los beneficios en la plataforma.</p>
    `
    : `
      <h2 style="color: #dc2626; margin-bottom: 8px;">Tu solicitud de verificación no pudo ser aprobada</h2>
      <p style="color: #374151; font-size: 15px;">Hola <strong>${firstName || "Proveedor"}</strong>,</p>
      <p style="color: #374151; font-size: 15px;">Revisamos la información y evidencias enviadas para tu solicitud de verificación.</p>
      <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 16px 0; color: #991b1b;">
        <strong>Motivo:</strong> ${rejectionReason || "Información insuficiente o inconsistente."}
      </div>
      <p style="color: #374151; font-size: 15px;">Puedes ingresar a tu panel de proveedor, actualizar los datos o evidencias solicitadas y volver a enviar tu solicitud.</p>
    `;

  const body = {
    sender: { name: "ProveeLink", email: env.MAIL_FROM },
    to: [{ email: toEmail }],
    subject,
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 32px; border: 1px solid #e5e7eb; border-radius: 8px;">
        ${contentHtml}
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #9ca3af; font-size: 11px; text-align: center;">© ${new Date().getFullYear()} ProveeLink. Todos los derechos reservados.</p>
      </div>
    `,
  };

  try {
    const res = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": env.BREVO_API_KEY,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      logger.error({ status: res.status, brevo_error: errorBody, to: toEmail }, "Error Brevo al enviar resultado de verificación");
    } else {
      logger.info({ to: toEmail, status }, "Email de resultado de verificación enviado con éxito");
    }
  } catch (err) {
    logger.error({ err: err.message, to: toEmail }, "Fallo de red al enviar email de verificación via Brevo");
  }
};

