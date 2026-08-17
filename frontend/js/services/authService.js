/**
 * @file authService.js
 * @description Capa de servicios HTTP para el módulo de autenticación.
 * Centraliza todas las peticiones a la API y desacopla las URLs del código de negocio.
 * Sigue el principio de Responsabilidad Única (SRP).
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN BASE
// ─────────────────────────────────────────────────────────────────────────────

/** URL base de la API. Modificar aquí para cambiar de entorno. */
const API_BASE = "http://localhost:3000/api/v1/auth";

/**
 * Mapa de endpoints disponibles.
 * @readonly
 */
const ENDPOINTS = Object.freeze({
  LOGIN: `${API_BASE}/login`,
  REGISTER: `${API_BASE}/register`,
  REFRESH: `${API_BASE}/refresh`,
  VERIFY_OTP: `${API_BASE}/verify`,
  RESEND_OTP: `${API_BASE}/resend-otp`,
});

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDAD INTERNA DE FETCH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wrapper genérico para peticiones HTTP POST con JSON.
 * Lanza un Error si el servidor responde con un status no-ok.
 *
 * @param {string} url   - Endpoint de destino.
 * @param {object} body  - Cuerpo de la petición.
 * @param {string} [token] - Token Bearer opcional para peticiones autenticadas.
 * @returns {Promise<object>} Datos parseados de la respuesta JSON.
 * @throws {Error} Con la propiedad `data` conteniendo la respuesta del servidor.
 */
async function postJSON(url, body, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    // Enriquecemos el error con la data del servidor para mensajes contextuales
    const error = new Error(data.message || "Error desconocido del servidor.");
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICIOS EXPORTADOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inicia sesión con correo y contraseña.
 * @param {{ email: string, password: string }} credentials
 * @returns {Promise<{ accessToken: string, refreshToken: string, user: object }>}
 */
export async function loginService(credentials) {
  return postJSON(ENDPOINTS.LOGIN, credentials);
}

/**
 * Registra un nuevo usuario.
 * @param {{ email: string, password: string }} userData
 * @returns {Promise<{ message: string, userId: string }>}
 */
export async function registerService(userData) {
  return postJSON(ENDPOINTS.REGISTER, userData);
}

/**
 * Renueva el access token usando el refresh token almacenado.
 * Se invoca de forma silenciosa cada 2 horas.
 * @returns {Promise<{ accessToken: string }>}
 */
export async function refreshTokenService() {
  const refreshToken = localStorage.getItem("refreshToken");
  if (!refreshToken) {
    throw new Error("No hay refresh token disponible. Sesión expirada.");
  }
  return postJSON(ENDPOINTS.REFRESH, { refreshToken });
}

/**
 * Verifica el código OTP enviado al correo del usuario.
 * @param {{ email: string, otp: string }} payload
 * @returns {Promise<{ accessToken: string, refreshToken: string, user: object }>}
 */
export async function verifyOtpService(payload) {
  return postJSON(ENDPOINTS.VERIFY_OTP, payload);
}

/**
 * Solicita el reenvío de un nuevo código OTP al correo registrado.
 * @param {{ email: string }} payload
 * @returns {Promise<{ message: string }>}
 */
export async function resendOtpService(payload) {
  return postJSON(ENDPOINTS.RESEND_OTP, payload);
}
