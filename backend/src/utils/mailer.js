import { Resend } from "resend";
import { env } from "../config/environment.js";
import { logger } from "./logger.js";
import { AppError } from "./AppError.js";

const resend = new Resend(env.RESEND_API_KEY);

/**
 * Envía el código OTP de verificación por correo electrónico via Resend API.
 * Usa HTTP (puerto 443) — compatible con Render y cualquier plataforma cloud.
 *
 * @param {string} toEmail   Destinatario
 * @param {string} otpCode   Código OTP en texto plano (6 dígitos)
 * @returns {Promise<void>}
 */
export const sendOtpEmail = async (toEmail, otpCode) => {
  try {
    const { data, error } = await resend.emails.send({
      from: env.MAIL_FROM,
      to: [toEmail],
      subject: "Tu código de verificación — ProveeLink",
      text: `Tu código de verificación es: ${otpCode}\n\nEste código expira en 15 minutos.\nSi no solicitaste esto, ignora este mensaje.`,
      html: `
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
    });

    if (error) {
      logger.error({ resend_error: error, to: toEmail }, "Error Resend al enviar OTP");
      throw new AppError(`Error al enviar correo: ${error.message}`, 503);
    }

    logger.info({ to: toEmail, id: data?.id }, "OTP enviado por correo via Resend");
  } catch (err) {
    if (err instanceof AppError) throw err;
    logger.error({ error: err.message, to: toEmail }, "Error inesperado en sendOtpEmail");
    throw new AppError(`Error al enviar correo: ${err.message}`, 503);
  }
};
