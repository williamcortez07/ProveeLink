/**
 * @file supplierService.js
 * @description Capa de servicios HTTP para el módulo de Proveedores (Suppliers).
 *
 * Centraliza todas las peticiones a la API de /suppliers.
 * Reutiliza el sistema de tokens de TokenManager (api.js).
 */

import { TokenManager } from "./api.js";

const API_BASE_URL = "http://localhost:3000/api/v1";

/**
 * Mapa de endpoints del módulo Supplier.
 * @readonly
 */
const SUPPLIER_ENDPOINTS = Object.freeze({
  CREATE: `${API_BASE_URL}/suppliers`,
  LIST: `${API_BASE_URL}/suppliers`,
  GET_BY_ID: (id) => `${API_BASE_URL}/suppliers/${id}`,
  UPGRADE_ROLE: `${API_BASE_URL}/auth/upgrade-role`,
});

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
 * @namespace supplierService
 */
export const supplierService = {
  /**
   * Registra un nuevo perfil de Proveedor para una empresa existente.
   *
   * DTO requerido (supplierSchema.js):
   * @param {{
   *   company_id: string,
   *   supplier_type: string,
   *   service_description: string,
   *   geographic_coverage: "local"|"regional"|"national",
   *   operating_hours: string
   * }} payload
   * @returns {Promise<{ success: boolean, message: string, data: object, auth?: object }>}
   */
  create(payload) {
    return request(SUPPLIER_ENDPOINTS.CREATE, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /**
   * Obtiene el perfil de proveedor asociado a una empresa dada.
   * @param {string} companyId - UUID de la empresa.
   * @returns {Promise<object|null>} Objeto de proveedor si existe, null si no.
   */
  async getByCompanyId(companyId) {
    const url = `${SUPPLIER_ENDPOINTS.LIST}?company_id=${encodeURIComponent(companyId)}&pageSize=1`;
    const response = await request(url, { method: "GET" });
    const suppliers = response?.data ?? [];
    return suppliers.length > 0 ? suppliers[0] : null;
  },

  /**
   * Obtiene un proveedor por su ID.
   * @param {string} supplierId
   * @returns {Promise<object>}
   */
  getById(supplierId) {
    return request(SUPPLIER_ENDPOINTS.GET_BY_ID(supplierId), { method: "GET" });
  },

  /**
   * Re-emite JWT con el rol actualizado.
   * @returns {Promise<object>}
   */
  upgradeRole() {
    return request(SUPPLIER_ENDPOINTS.UPGRADE_ROLE, { method: "POST" });
  },
};
