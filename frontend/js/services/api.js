/**
 * @file api.js
 * @description Capa centralizada de comunicación API y gestión de tokens.
 *
 * Responsabilidades:
 *  1. TokenManager — ciclo de vida del JWT (get/save/remove/decode/validate)
 *  2. RoleManager  — sistema centralizado de roles (lee el token una sola vez)
 *  3. homeApi      — funciones de fetch para el módulo Home
 *
 * Ningún otro módulo debe hacer fetch() directo. Todos consumen este archivo.
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE_URL = "http://localhost:3000/api/v1";

/**
 * Mapa de endpoints del módulo Home.
 * @readonly
 */
const HOME_ENDPOINTS = Object.freeze({
  FEATURED_SUPPLIERS: `${API_BASE_URL}/suppliers/featured`,
  CATEGORIES: `${API_BASE_URL}/categories`,
  SEARCH_SUPPLIERS: `${API_BASE_URL}/suppliers/search`,
  SUPPLIER_PROFILE: (id) => `${API_BASE_URL}/suppliers/${id}`,
  MY_PRODUCTS: `${API_BASE_URL}/products/mine`,
  ADD_PRODUCT: `${API_BASE_URL}/products`,
  UPDATE_PRODUCT: (id) => `${API_BASE_URL}/products/${id}`,
  DELETE_PRODUCT: (id) => `${API_BASE_URL}/products/${id}`,
  CHANGE_PRODUCT_STATUS: (id) => `${API_BASE_URL}/products/${id}/status`,
  PRODUCT_IMAGES: (id) => `${API_BASE_URL}/products/${id}/images`,
  DELETE_PRODUCT_IMAGE: (id, imageId) => `${API_BASE_URL}/products/${id}/images/${imageId}`,
  COMPANY_PRODUCTS: `${API_BASE_URL}/company/products`,
  USER_PROFILE: `${API_BASE_URL}/profile`,
  FAVORITES: `${API_BASE_URL}/favorites`,
});

/**
 * Mapa de endpoints del módulo de Perfil de Usuario.
 * @readonly
 */
const USER_ENDPOINTS = Object.freeze({
  /** GET  /users/:id  — perfil completo del usuario autenticado */
  GET_BY_ID:    (id) => `${API_BASE_URL}/users/${id}`,
  /** PATCH /users/:id  — actualiza datos personales */
  UPDATE:       (id) => `${API_BASE_URL}/users/${id}`,
  /** PATCH /users/:id  — eliminado lógico { status: "inactive" } */
  DEACTIVATE:   (id) => `${API_BASE_URL}/users/${id}`,
});

// ─────────────────────────────────────────────────────────────────────────────
// ROLES — constantes centralizadas (nunca comparar strings literales)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Roles disponibles en el sistema.
 * @readonly
 * @enum {string}
 */
export const ROLES = Object.freeze({
  USER: "user",
  SUPPLIER: "supplier",
  COMPANY: "company",
});

/**
 * Mapa de normalización: traduce los role_name del backend (en español o inglés,
 * con cualquier capitalización) a las constantes internas de ROLES.
 * @param {string|null} rawRole
 * @returns {string|null} Valor normalizado (ROLES.USER, ROLES.SUPPLIER, ROLES.COMPANY) o null.
 */
function normalizeRole(rawRole) {
  if (!rawRole) return null;
  const ROLE_MAP = {
    // Español
    cliente:     ROLES.USER,
    clientes:    ROLES.USER,
    proveedor:   ROLES.SUPPLIER,
    proveedores: ROLES.SUPPLIER,
    empresa:     ROLES.COMPANY,
    empresas:    ROLES.COMPANY,
    // Inglés (por si cambian en el futuro)
    user:        ROLES.USER,
    supplier:    ROLES.SUPPLIER,
    company:     ROLES.COMPANY,
  };
  return ROLE_MAP[rawRole.toLowerCase()] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// TOKEN MANAGER — gestión centralizada del JWT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @namespace TokenManager
 * Centraliza toda la lógica de acceso al JWT.
 * Es la única fuente de verdad para el token en toda la aplicación.
 */
export const TokenManager = {
  /** Claves de localStorage */
  _KEYS: Object.freeze({
    ACCESS: "accessToken",
    REFRESH: "refreshToken",
  }),

  /**
   * Retorna el access token almacenado o null.
   * @returns {string|null}
   */
  getToken() {
    const val = localStorage.getItem(this._KEYS.ACCESS);
    if (!val || val === "undefined" || val === "null") return null;
    return val;
  },

  /**
   * Retorna el refresh token almacenado o null.
   * @returns {string|null}
   */
  getRefreshToken() {
    const val = localStorage.getItem(this._KEYS.REFRESH);
    if (!val || val === "undefined" || val === "null") return null;
    return val;
  },

  /**
   * Guarda access y/o refresh token.
   * @param {{ accessToken: string, refreshToken?: string }} tokens
   */
  saveToken(data) {
    if (!data) return;
    const accessToken =
      data.accessToken ||
      data.data?.accessToken ||
      data.token ||
      data.data?.token;
    const refreshToken = data.refreshToken || data.data?.refreshToken;
    if (accessToken) localStorage.setItem(this._KEYS.ACCESS, accessToken);
    if (refreshToken) localStorage.setItem(this._KEYS.REFRESH, refreshToken);
  },

  /** Elimina todos los tokens de localStorage. */
  removeToken() {
    localStorage.removeItem(this._KEYS.ACCESS);
    localStorage.removeItem(this._KEYS.REFRESH);
  },

  /**
   * Decodifica el payload del JWT sin verificar la firma (client-side only).
   * @returns {object|null} Payload decodificado o null si el token es inválido.
   */
  decodePayload() {
    const token = this.getToken();
    if (!token) return null;
    try {
      const [, payloadB64] = token.split(".");
      if (!payloadB64) return null;
      const json = atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/"));
      return JSON.parse(json);
    } catch {
      console.warn("[TokenManager] No se pudo decodificar el JWT.");
      return null;
    }
  },

  /**
   * Verifica si hay un token activo y no expirado.
   * @returns {boolean}
   */
  isAuthenticated() {
    const payload = this.decodePayload();
    if (!payload) return false;
    if (!payload.exp) return true; // Sin expiración → válido
    return Date.now() < payload.exp * 1000;
  },

  /**
   * Retorna el objeto de usuario extraído del JWT.
   * @returns {{ id: string, email: string, role: string }|null}
   */
  getUser() {
    const payload = this.decodePayload();
    if (!payload) return null;
    // El backend puede enviar el rol como 'role_name' (ej: "Proveedor") o 'role'.
    // Normalizamos siempre a las constantes internas de ROLES.
    const rawRole = payload.role_name ?? payload.role ?? null;
    return {
      id: payload.id ?? payload.sub ?? null,
      email: payload.email ?? null,
      role: normalizeRole(rawRole),
      role_id: payload.role_id ?? null,
    };
  },

  /**
   * Retorna el rol del usuario autenticado.
   * @returns {string|null} Uno de los valores de ROLES o null.
   */
  getUserRole() {
    return this.getUser()?.role ?? null;
  },

  /**
   * Cierra la sesión: elimina tokens y redirige al login.
   * @param {string} [redirectTo="/"] - Ruta de redirección.
   */
  logout(redirectTo = "../../index.html") {
    this.removeToken();
    window.location.href = redirectTo;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// ROLE MANAGER — helpers semánticos de rol (lee el token una sola vez)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @namespace RoleManager
 * Provee helpers de rol reutilizables. Evita comparaciones de strings literales
 * dispersas por el código.
 */
export const RoleManager = {
  /**
   * Retorna el rol actual del usuario.
   * @returns {string|null}
   */
  getCurrentRole() {
    return TokenManager.getUserRole();
  },

  /**
   * Verifica si el usuario tiene un rol específico.
   * @param {string} role - Usar las constantes de ROLES.
   * @returns {boolean}
   */
  hasRole(role) {
    return this.getCurrentRole() === role;
  },

  /** @returns {boolean} */
  isUser() {
    return this.hasRole(ROLES.USER);
  },

  /** @returns {boolean} */
  isSupplier() {
    return this.hasRole(ROLES.SUPPLIER);
  },

  /** @returns {boolean} */
  isCompany() {
    return this.hasRole(ROLES.COMPANY);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDAD INTERNA DE FETCH — wrapper reutilizable con Authorization automático
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construye headers con Authorization si hay token disponible.
 * @param {object} [extra={}] - Headers adicionales.
 * @returns {object}
 */
function buildHeaders(extra = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...extra,
  };
  const token = TokenManager.getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Wrapper genérico para peticiones HTTP con manejo centralizado de errores.
 *
 * @param {string} url           - Endpoint.
 * @param {RequestInit} [options={}] - Opciones de fetch.
 * @returns {Promise<object>}    - Datos JSON de la respuesta.
 * @throws {Error}               - Con `.status` y `.data` enriquecidos.
 */
async function request(url, options = {}) {
  if (!TokenManager.isAuthenticated()) {
    // Sesión inválida: redirige al login
    TokenManager.logout();
    throw new Error("Sesión expirada. Por favor inicia sesión de nuevo.");
  }

  const response = await fetch(url, {
    ...options,
    headers: buildHeaders(options.headers),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      data.message || `Error ${response.status}: ${response.statusText}`,
    );
    error.status = response.status;
    error.data = data;

    // 401 → sesión inválida en servidor
    if (response.status === 401) {
      TokenManager.logout();
    }

    throw error;
  }

  return data;
}

/** GET helper */
const get = (url) => request(url, { method: "GET" });
/** POST helper */
const post = (url, body) =>
  request(url, { method: "POST", body: JSON.stringify(body) });
/** PUT helper */
const put = (url, body) =>
  request(url, { method: "PUT", body: JSON.stringify(body) });
/** PATCH helper */
const patch = (url, body) =>
  request(url, { method: "PATCH", body: JSON.stringify(body) });
/** DELETE helper */
const del = (url) => request(url, { method: "DELETE" });

// ─────────────────────────────────────────────────────────────────────────────
// HOME API — funciones de negocio para el módulo Home
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @namespace homeApi
 * Todas las peticiones del módulo Home deben pasar por aquí.
 * home.js NUNCA llama fetch() directamente.
 */
export const homeApi = {
  // ── Comunes a todos los roles ──────────────────────────────────────────────

  /**
   * Obtiene las categorías disponibles.
   * @returns {Promise<Array<{ id: string, name: string, icon: string }>>}
   */
  getCategories() {
    return get(HOME_ENDPOINTS.CATEGORIES);
  },

  /**
   * Obtiene una categoría por su ID.
   * @param {string} categoryId
   * @returns {Promise<object>}
   */
  getCategoryById(categoryId) {
    return get(`${HOME_ENDPOINTS.CATEGORIES}/${encodeURIComponent(categoryId)}`);
  },

  /**
   * Obtiene proveedores destacados para el carrusel.
   * @returns {Promise<Array<object>>}
   */
  getFeaturedSuppliers() {
    return get(HOME_ENDPOINTS.FEATURED_SUPPLIERS);
  },

  /**
   * Busca proveedores por término de búsqueda.
   * @param {string} query
   * @returns {Promise<Array<object>>}
   */
  searchSuppliers(searchTerm) {
    const url = `${HOME_ENDPOINTS.SEARCH_SUPPLIERS}?query=${encodeURIComponent(searchTerm)}`;
    return get(url);
  },

  /**
   * Obtiene el listado paginado de proveedores.
   * @param {{ page?: number, pageSize?: number, sortBy?: string, sortOrder?: string, company_id?: string, category_id?: string }} opts
   * @returns {Promise<{ data: Array<object>, pagination: object }>}
   */
  getSuppliers({ page = 1, pageSize = 10, sortBy = 'created_at', sortOrder = 'desc', company_id, category_id } = {}) {
    const params = new URLSearchParams({ page, pageSize, sortBy, sortOrder });
    if (company_id) params.append('company_id', company_id);
    if (category_id) params.append('category_id', category_id);
    return get(`${API_BASE_URL}/suppliers?${params.toString()}`);
  },

  /**
   * Obtiene el perfil de un proveedor por ID.
   * @param {string} supplierId
   * @returns {Promise<object>}
   */
  getSupplierProfile(supplierId) {
    return get(HOME_ENDPOINTS.SUPPLIER_PROFILE(supplierId));
  },

  /**
   * Obtiene los productos del proveedor autenticado (dashboard del proveedor).
   * Usa GET /products/mine — el backend deriva supplier_id del JWT.
   * No expone ni acepta un supplier_id desde el cliente.
   * @returns {Promise<object>}
   */
  getMyProducts() {
    return get(HOME_ENDPOINTS.MY_PRODUCTS);
  },

  /**
   * Obtiene los productos de un proveedor por ID (uso público/catálogo general).
   * NO usar para el dashboard del proveedor — usar getMyProducts() en su lugar.
   * @param {string} supplierId
   * @returns {Promise<object>}
   */
  getProductsBySupplier(supplierId) {
    return get(`${API_BASE_URL}/products?supplier_id=${encodeURIComponent(supplierId)}`);
  },

  /**
   * Obtiene el perfil del usuario autenticado.
   * @returns {Promise<object>}
   */
  getUserProfile() {
    return get(HOME_ENDPOINTS.USER_PROFILE);
  },

  // ── Usuario (ROLES.USER) ───────────────────────────────────────────────────

  /**
   * Obtiene los favoritos del usuario.
   * @returns {Promise<Array<object>>}
   */
  getFavorites() {
    return get(HOME_ENDPOINTS.FAVORITES);
  },

  /**
   * Agrega un proveedor a favoritos.
   * @param {string} supplierId
   * @returns {Promise<object>}
   */
  addFavorite(supplierId) {
    return post(HOME_ENDPOINTS.FAVORITES, { supplierId });
  },

  // ── Proveedor (ROLES.SUPPLIER) ─────────────────────────────────────────────

  /**
   * Obtiene los productos propios del proveedor autenticado.
   * @returns {Promise<Array<object>>}
   */
  getMyProducts() {
    return get(HOME_ENDPOINTS.MY_PRODUCTS);
  },

  /**
   * Crea un nuevo producto.
   * @param {{ name: string, price: number, description: string, category: string }} product
   * @returns {Promise<object>}
   */
  addProduct(product) {
    return post(HOME_ENDPOINTS.ADD_PRODUCT, product);
  },

  /**
   * Actualiza un producto existente.
   * @param {string} productId
   * @param {object} updates
   * @returns {Promise<object>}
   */
  updateProduct(productId, updates) {
    return patch(HOME_ENDPOINTS.UPDATE_PRODUCT(productId), updates);
  },

  /**
   * Cambia el estado de un producto.
   * @param {string} productId
   * @param {string} status
   * @returns {Promise<object>}
   */
  changeProductStatus(productId, status) {
    return patch(HOME_ENDPOINTS.CHANGE_PRODUCT_STATUS(productId), { status });
  },

  /**
   * Elimina un producto del proveedor.
   * @param {string} productId
   * @returns {Promise<object>}
   */
  deleteProduct(productId) {
    return del(HOME_ENDPOINTS.DELETE_PRODUCT(productId));
  },

  /**
   * Obtiene las imágenes de un producto.
   * @param {string} productId
   * @returns {Promise<object>}
   */
  getProductImages(productId) {
    return get(HOME_ENDPOINTS.PRODUCT_IMAGES(productId));
  },

  /**
   * Agrega una imagen a un producto.
   * @param {string} productId
   * @param {{ image_url: string, is_primary?: boolean }} imageData
   * @returns {Promise<object>}
   */
  addProductImage(productId, imageData) {
    return post(HOME_ENDPOINTS.PRODUCT_IMAGES(productId), imageData);
  },

  /**
   * Elimina una imagen de un producto.
   * @param {string} productId
   * @param {string} imageId
   * @returns {Promise<object>}
   */
  deleteProductImage(productId, imageId) {
    return del(HOME_ENDPOINTS.DELETE_PRODUCT_IMAGE(productId, imageId));
  },

  // ── Empresa (ROLES.COMPANY) ────────────────────────────────────────────────

  /**
   * Obtiene el catálogo de productos de la empresa.
   * @returns {Promise<Array<object>>}
   */
  getCompanyProducts() {
    return get(HOME_ENDPOINTS.COMPANY_PRODUCTS);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE API — operaciones CRUD del perfil de usuario autenticado
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @namespace profileApi
 * Todas las peticiones del módulo de perfil deben pasar por aquí.
 * profile.js NUNCA llama fetch() directamente.
 */
export const profileApi = {
  /**
   * Obtiene el perfil completo de un usuario por su ID.
   * @param {string} userId
   * @returns {Promise<object>} Objeto con { data: [...], meta: {...} }
   */
  getById(userId) {
    return get(USER_ENDPOINTS.GET_BY_ID(userId));
  },

  /**
   * Actualiza los datos personales del usuario.
   * @param {string} userId
   * @param {{ first_name?: string, last_name?: string, email?: string,
   *           phone?: string, password?: string, profile_picture_url?: string }} payload
   * @returns {Promise<object>}
   */
  update(userId, payload) {
    return patch(USER_ENDPOINTS.UPDATE(userId), payload);
  },

  /**
   * Realiza el eliminado lógico de la cuenta (status → "inactive").
   * @param {string} userId
   * @returns {Promise<object>}
   */
  deactivate(userId) {
    return patch(USER_ENDPOINTS.DEACTIVATE(userId), { status: "inactive" });
  },
};
