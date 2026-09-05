/**
 * @file adminApi.js
 * @description Capa centralizada de peticiones HTTP para el Panel Administrativo.
 * Todas las llamadas al backend admin pasan por aquí.
 * NUNCA llamar fetch() directamente desde los módulos de UI.
 */

const API_BASE_URL = "http://localhost:3000/api/v1";

const ADMIN_ENDPOINTS = Object.freeze({
  LOGIN: `${API_BASE_URL}/auth/login`,
  ADMIN_VERIFY: `${API_BASE_URL}/auth/admin-verify`,
  ADMIN_RESEND: `${API_BASE_URL}/auth/admin-resend-otp`,
  STATS: `${API_BASE_URL}/admin/stats`,
  USERS: `${API_BASE_URL}/admin/users`,
  USER_STATUS: (id) => `${API_BASE_URL}/admin/users/${id}/status`,
  VERIFICATIONS: `${API_BASE_URL}/admin/verifications`,
  VERIFICATION_DETAIL: (id) => `${API_BASE_URL}/admin/verifications/${id}`,
  VERIFY_APPROVE: (id) => `${API_BASE_URL}/admin/verifications/${id}/approve`,
  VERIFY_REJECT: (id) => `${API_BASE_URL}/admin/verifications/${id}/reject`,
  VER_REQUESTS: `${API_BASE_URL}/verification/admin/requests`,
  VER_REQUEST_DETAIL: (id) =>
    `${API_BASE_URL}/verification/admin/requests/${id}`,
  VER_REQUEST_APPROVE: (id) =>
    `${API_BASE_URL}/verification/admin/requests/${id}/approve`,
  VER_REQUEST_REJECT: (id) =>
    `${API_BASE_URL}/verification/admin/requests/${id}/reject`,
  CATEGORIES: `${API_BASE_URL}/categories`,
  CATEGORY_BY_ID: (id) => `${API_BASE_URL}/categories/${id}`,
  ADMINISTRATORS: `${API_BASE_URL}/admin/administrators`,
});

function getAdminToken() {
  const val = localStorage.getItem("accessToken");
  if (!val || val === "undefined" || val === "null") return null;
  return val;
}

/**
 * Construye los headers con Authorization Bearer.
 * @param {object} [extra={}]
 * @returns {object}
 */
function buildHeaders(extra = {}) {
  const headers = { "Content-Type": "application/json", ...extra };
  const token = getAdminToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

/**
 * Wrapper genérico para peticiones autenticadas al panel admin.
 * Si recibe 401, limpia la sesión y redirige al login admin.
 *
 * @param {string} url
 * @param {RequestInit} [options={}]
 * @returns {Promise<object>}
 */
async function adminRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: buildHeaders(options.headers),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      window.location.href = "../../pages/admin/login.html";
      return;
    }
    const error = new Error(data.message || `Error ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

async function publicRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || `Error ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

const get = (url) => adminRequest(url, { method: "GET" });
const post = (url, body) =>
  adminRequest(url, { method: "POST", body: JSON.stringify(body) });
const patch = (url, body) =>
  adminRequest(url, { method: "PATCH", body: JSON.stringify(body) });
const put = (url, body) =>
  adminRequest(url, { method: "PUT", body: JSON.stringify(body) });
const del = (url) => adminRequest(url, { method: "DELETE" });

export const authAdminApi = {
  login({ email, password }) {
    return publicRequest(ADMIN_ENDPOINTS.LOGIN, {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  verify({ email, code }) {
    return publicRequest(ADMIN_ENDPOINTS.ADMIN_VERIFY, {
      method: "POST",
      body: JSON.stringify({ email, code }),
    });
  },

  resend({ email }) {
    return publicRequest(ADMIN_ENDPOINTS.ADMIN_RESEND, {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },
};

export const statsApi = {
  getStats() {
    return get(ADMIN_ENDPOINTS.STATS);
  },
};

export const usersAdminApi = {
  /**
   * @param {{ page?, limit?, status?, role_id?, search?, sortBy?, sortOrder? }} opts
   */
  getAll(opts = {}) {
    const params = new URLSearchParams();
    if (opts.page) params.append("page", String(opts.page));
    if (opts.limit) params.append("limit", String(opts.limit));
    if (opts.status) params.append("status", opts.status);
    if (opts.role_id) params.append("role_id", opts.role_id);
    if (opts.search) params.append("search", opts.search);
    if (opts.sortBy) params.append("sortBy", opts.sortBy);
    if (opts.sortOrder) params.append("sortOrder", opts.sortOrder);
    const qs = params.toString();
    return get(`${ADMIN_ENDPOINTS.USERS}${qs ? `?${qs}` : ""}`);
  },

  changeStatus(userId, status) {
    return patch(ADMIN_ENDPOINTS.USER_STATUS(userId), { status });
  },
};

export const verificationsApi = {
  /**
   * Verificaciones legadas (companies.verification_status directo)
   * @param {{ page?, limit?, status?, search? }} opts
   */
  getAll(opts = {}) {
    const params = new URLSearchParams();
    if (opts.page) params.append("page", String(opts.page));
    if (opts.limit) params.append("limit", String(opts.limit));
    if (opts.status) params.append("status", opts.status);
    if (opts.search) params.append("search", opts.search);
    const qs = params.toString();
    return get(`${ADMIN_ENDPOINTS.VERIFICATIONS}${qs ? `?${qs}` : ""}`);
  },

  getDetail(companyId) {
    return get(ADMIN_ENDPOINTS.VERIFICATION_DETAIL(companyId));
  },

  approve(companyId) {
    return patch(ADMIN_ENDPOINTS.VERIFY_APPROVE(companyId), {});
  },

  reject(companyId, rejection_reason = "") {
    return patch(ADMIN_ENDPOINTS.VERIFY_REJECT(companyId), {
      rejection_reason,
    });
  },
};

export const verRequestsApi = {
  /**
   * Lista solicitudes del nuevo sistema
   * @param {{ page?, pageSize?, status?, search? }} opts
   */
  getAll(opts = {}) {
    const params = new URLSearchParams();
    if (opts.page) params.append("page", String(opts.page));
    if (opts.pageSize) params.append("pageSize", String(opts.pageSize));
    if (opts.status) params.append("status", opts.status);
    if (opts.search) params.append("search", opts.search);
    const qs = params.toString();
    return get(`${ADMIN_ENDPOINTS.VER_REQUESTS}${qs ? `?${qs}` : ""}`);
  },

  getDetail(requestId) {
    return get(ADMIN_ENDPOINTS.VER_REQUEST_DETAIL(requestId));
  },

  approve(requestId) {
    return patch(ADMIN_ENDPOINTS.VER_REQUEST_APPROVE(requestId), {});
  },

  reject(requestId, rejection_reason) {
    return patch(ADMIN_ENDPOINTS.VER_REQUEST_REJECT(requestId), {
      rejection_reason,
    });
  },
};

export const categoriesAdminApi = {
  /**
   * @param {{ page?, limit?, name? }} opts
   */
  getAll(opts = {}) {
    const params = new URLSearchParams();
    if (opts.page) params.append("page", String(opts.page));
    if (opts.limit) params.append("limit", String(opts.limit));
    if (opts.name) params.append("name", opts.name);
    const qs = params.toString();
    return get(`${ADMIN_ENDPOINTS.CATEGORIES}${qs ? `?${qs}` : ""}`);
  },

  getById(id) {
    return get(ADMIN_ENDPOINTS.CATEGORY_BY_ID(id));
  },

  create(data) {
    return post(ADMIN_ENDPOINTS.CATEGORIES, data);
  },

  update(id, data) {
    return put(ADMIN_ENDPOINTS.CATEGORY_BY_ID(id), data);
  },

  delete(id) {
    return del(ADMIN_ENDPOINTS.CATEGORY_BY_ID(id));
  },
};

export const administratorsApi = {
  getAll(opts = {}) {
    const params = new URLSearchParams();
    if (opts.page) params.append("page", String(opts.page));
    if (opts.limit) params.append("limit", String(opts.limit));
    const qs = params.toString();
    return get(`${ADMIN_ENDPOINTS.ADMINISTRATORS}${qs ? `?${qs}` : ""}`);
  },

  create(data) {
    return post(ADMIN_ENDPOINTS.ADMINISTRATORS, data);
  },
};
