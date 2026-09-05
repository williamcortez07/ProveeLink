/**
 * @file routes.js
 * @description Guardián de Navegación y Enrutador Basado en Roles (Role-Based Route Guard).
 *
 * Responsabilidades (SRP):
 *  - Verificación de sesión activa (Auth Guard).
 *  - Validación y control de permisos por rol (Role Guard Boundary).
 *  - Redirección centralizada a la página/dashboard correspondiente según el rol del JWT.
 *  - Prevención de bucles de redirección (Redirect Loop Safety).
 *
 * NOTA sobre rutas:
 *  Todas las rutas en ROLE_ROUTES y ALLOWED_SUBROUTES se expresan relativas a la raíz
 *  del frontend (donde vive index.html). La función getBasePath() calcula dinámicamente
 *  cuántos niveles hay que subir desde la página actual para llegar a esa raíz, evitando
 *  el bug de doble-carpeta (ej: /pages/pages/home.html) cuando se redirige desde
 *  páginas en subdirectorios.
 *
 * NOTA sobre transición de rol (Cliente → Empresa):
 *  Cuando el usuario crea su empresa, el backend emite nuevos JWT en response.auth.
 *  El frontend los persiste via TokenManager.saveToken(). Como fallback, homeCompany.html
 *  está en las rutas de ROLES.USER y company.js llama upgradeRole() para sincronizar.
 *
 * esto es lo que se hace hasta el 12/8/26
 *
 */

import { TokenManager, RoleManager, ROLES } from "./api.js";
function getBasePath() {
  const parts = window.location.pathname.split("/").filter((p) => p !== "");
  const dirParts = parts.slice(0, -1);
  const pagesIdx = dirParts.indexOf("pages");

  if (pagesIdx === -1) {
    return "./";
  }
  const depth = dirParts.length - pagesIdx;
  return "../".repeat(depth);
}

function resolveRoute(route) {
  const cleanRoute = route.replace(/^\.\//, ""); // quitar "./" inicial
  return getBasePath() + cleanRoute;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES DE RUTAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mapa de rutas principales por rol (relativas a la raíz del frontend).
 * @type {Readonly<Record<string, string>>}
 */
export const ROLE_ROUTES = Object.freeze({
  [ROLES.USER]: "pages/home.html",
  [ROLES.SUPPLIER]: "pages/supplier/homeSupplier.html",
  [ROLES.COMPANY]: "pages/company/homeCompany.html",
  [ROLES.ADMIN]: "pages/admin/dashboard.html",
  PUBLIC_LOGIN: "index.html",
});

/**
 * Segmentos de ruta permitidos por rol para la verificación de acceso.
 * Se usan como substrings contra window.location.pathname — NO incluyen "./"
 * para que el match funcione correctamente con URLs absolutas.
 *
 * ROLES.USER incluye "pages/company/homeCompany.html" como ruta de transición:
 *  Ocurre cuando el token dice "Cliente" pero el backend ya actualizó el rol a "Empresa".
 *  company.js llama upgradeRole() para sincronizar el token automáticamente.
 */
const ALLOWED_SUBROUTES = Object.freeze({
  [ROLES.USER]: [
    "pages/home.html",
    "pages/category.html",
    "pages/categoryInfo.html",
    "pages/supplier/",
    "pages/favorites.html",
    "pages/profile.html",
    "pages/company/createCompany.html",
    "pages/company/homeCompany.html",
  ],
  [ROLES.SUPPLIER]: [
    "pages/supplier/",
    "pages/company/",
    "pages/home.html",
    "pages/profile.html",
    "pages/category.html",
    "pages/categoryInfo.html",
    "pages/favorites.html",
  ],
  [ROLES.COMPANY]: [
    "pages/company/",
    "pages/supplier/",
    "pages/home.html",
    "pages/profile.html",
    "pages/category.html",
    "pages/categoryInfo.html",
    "pages/favorites.html",
  ],
  [ROLES.ADMIN]: [
    "pages/admin/",
  ],
});

export const Router = {
  init() {
    if (!TokenManager.isAuthenticated()) {
      console.warn(
        "[Router] Sesión no válida o token expirado. Redirigiendo al Login...",
      );
      this.redirectToLogin();
      return null;
    }
    const role = RoleManager.getCurrentRole();
    if (!role || !Object.values(ROLES).includes(role)) {
      console.error(
        "[Router] Rol no identificado o no autorizado. Forzando cierre de sesión.",
      );
      TokenManager.logout();
      return null;
    }

    const user = TokenManager.getUser();

    // Enforce Role Boundary: Garantizar que el usuario esté en su área permitida
    this.enforceRoleBoundary(role);

    return { user, role };
  },

  /**
   * Redirige al dashboard del rol actual (o del rol pasado).
   * Usa resolveRoute() para calcular la URL correcta sin importar la profundidad.
   *
   * @param {string} [overrideRole] - Rol explícito para sobrescribir (opcional).
   */
  redirectByRole(overrideRole = null) {
    const role = overrideRole || RoleManager.getCurrentRole();
    const rawRoute = ROLE_ROUTES[role] || ROLE_ROUTES.PUBLIC_LOGIN;
    const targetUrl = resolveRoute(rawRoute);
    const currentPath = window.location.pathname;
    if (!currentPath.endsWith(rawRoute)) {
      console.info(
        `[Router] Despachando usuario con rol "${role}" a: ${targetUrl}`,
      );
      window.location.href = targetUrl;
    }
  },
  redirectToCreateCompany() {
    const role = RoleManager.getCurrentRole();
    if (role === ROLES.COMPANY) {
      window.location.href = resolveRoute(ROLE_ROUTES[ROLES.COMPANY]);
      return;
    }
    window.location.href = resolveRoute("pages/company/createCompany.html");
  },
  enforceRoleBoundary(role) {
    const currentPath = window.location.pathname;
    const allowedSegments = ALLOWED_SUBROUTES[role] || [];

    const isAuthorized = allowedSegments.some((segment) =>
      currentPath.includes(segment),
    );

    if (!isAuthorized) {
      console.warn(
        `[Router] Acceso no autorizado para el rol "${role}" en "${currentPath}". Redirigiendo a su Dashboard...`,
      );
      this.redirectByRole(role);
    }
  },

  redirectToLogin() {
    const currentPath = window.location.pathname;
    const isAlreadyAtLogin =
      currentPath.endsWith("/index.html") ||
      currentPath === "/" ||
      currentPath.endsWith("/login.html");

    if (!isAlreadyAtLogin) {
      TokenManager.logout();
    }
  },
};
