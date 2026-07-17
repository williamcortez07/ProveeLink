import nodemailer from "nodemailer";
import { env } from "../config/environment.js";
import { logger } from "./logger.js";

const transporter = nodemailer.createTransport({
  host: env.MAIL_HOST,
  port: env.MAIL_PORT,
  secure: env.MAIL_SECURE,
  auth: {
    user: env.MAIL_USER,
    pass: env.MAIL_PASS,
  },
});

transporter.verify((err) => {
  if (err) {
    logger.warn({ err }, "SMTP no disponible — los correos no se enviarán");
  } else {
    logger.info("Conexión SMTP verificada correctamente");
  }
});

/**
 * Envía el código OTP de verificación por correo electrónico.
 *
 * @param {string} toEmail   Destinatario
 * @param {string} otpCode   Código OTP en texto plano (6 dígitos)
 * @returns {Promise<void>}
 */
export const sendOtpEmail = async (toEmail, otpCode) => {
  const mailOptions = {
    from: `"ProveeLink" <${env.MAIL_FROM}>`,
    to: toEmail,
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
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info({ to: toEmail }, "OTP enviado por correo");
  } catch (err) {
    logger.error({ err, to: toEmail }, "Error al enviar OTP por correo");
    throw new Error(
      "No se pudo enviar el correo de verificación. Intenta más tarde.",
    );
  }
};
