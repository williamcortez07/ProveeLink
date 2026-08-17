/**
 * @file companyService.js
 * @description Capa de servicios HTTP para el módulo de Empresa (Company).
 *
 * Centraliza todas las peticiones a la API de /companies.
 * Reutiliza el sistema de tokens de TokenManager (api.js).
 * Ningún otro módulo de company debe hacer fetch() directo.
 */

import { TokenManager } from "./api.js";
const API_BASE_URL = "http://localhost:3000/api/v1";

/**
 * Mapa de endpoints del módulo Company.
 * @readonly
 */
const COMPANY_ENDPOINTS = Object.freeze({
  CREATE: `${API_BASE_URL}/companies`,
  LIST: `${API_BASE_URL}/companies`,
  GET_BY_ID: (id) => `${API_BASE_URL}/companies/${id}`,
  /** POST — re-emite JWT con el rol vigente del usuario en DB */
  UPGRADE_ROLE: `${API_BASE_URL}/auth/upgrade-role`,
});

//-----------------------------------------------------------------------_

/**
 * Construye headers con Authorization Bearer.
 * @param {object} [extra={}]
 * @returns {object}
 */
function buildHeaders(extra = {}) {
  const headers = { "Content-Type": "application/json", ...extra };
  const token = TokenManager.getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

/**
 * Wrapper de fetch con manejo de errores enriquecido.
 * @param {string} url
 * @param {RequestInit} options
 * @returns {Promise<object>}
 */
async function request(url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: buildHeaders(options.headers),
    });
  } catch {
    const err = new Error(
      "No se pudo conectar con el servidor. Verifica tu conexión a internet.",
    );
    err.status = 0;
    throw err;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(
      data.message || `Error ${response.status}: ${response.statusText}`,
    );
    err.status = response.status;
    err.data = data;

    if (response.status === 401) {
      TokenManager.logout();
    }

    throw err;
  }

  return data;
}

/**
 * @namespace companyService
 */
export const companyService = {
  /**
   * Crea una nueva empresa vinculada al usuario autenticado.
   *
   * El DTO exacto requerido por el backend (companySchema.js):
   * @param {{
   *   user_id:        string,  — UUID del usuario (obligatorio)
   *   name:           string,  — min 2, max 100 (obligatorio)
   *   phone:          string,  — formato +503... (obligatorio)
   *   email:          string,  — email válido (obligatorio)
   *   address:        string,  — min 5 chars (obligatorio)
   *   state_province: string,  — min 5 chars (obligatorio)
   *   city:           string,  — min 5 chars (obligatorio)
   *   description?:   string,  — opcional
   *   tax_id?:        string,  — opcional
   *   logo_url?:      string|null, — URL válida o null, opcional
   *   website_url?:   string|null, — URL válida o null, opcional
   * }} payload
   * @returns {Promise<{ success: boolean, message: string, data: object }>}
   */
  create(payload) {
    return request(COMPANY_ENDPOINTS.CREATE, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /**
   * Verifica si el usuario autenticado ya tiene una empresa registrada.
   * @param {string} userId - UUID del usuario.
   * @returns {Promise<object|null>} La empresa si existe, null si no.
   */
  async getByUserId(userId) {
    const url = `${COMPANY_ENDPOINTS.LIST}?user_id=${encodeURIComponent(userId)}&pageSize=1`;
    const response = await request(url, { method: "GET" });
    const companies = response?.data ?? [];
    return companies.length > 0 ? companies[0] : null;
  },

  /**
   * Obtiene una empresa por su ID.
   * @param {string} companyId
   * @returns {Promise<object>}
   */
  getById(companyId) {
    return request(COMPANY_ENDPOINTS.GET_BY_ID(companyId), { method: "GET" });
  },

  /**
   * Actualiza los datos de una empresa existente.
   * @param {string} companyId
   * @param {object} payload
   * @returns {Promise<object>}
   */
  update(companyId, payload) {
    return request(COMPANY_ENDPOINTS.GET_BY_ID(companyId), {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  },

  /**
   * @returns {Promise<{ success: boolean, data: { accessToken, refreshToken, expiresIn, role_name } }>}
   */
  upgradeRole() {
    return request(COMPANY_ENDPOINTS.UPGRADE_ROLE, { method: "POST" });
  },
};

