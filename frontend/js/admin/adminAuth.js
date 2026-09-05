/**
 * @file adminAuth.js
 * @description Guard de autenticación, gestor de temas y módulo de sesión para el Panel Admin.
 *
 * Responsabilidades:
 *  - Gestor de Temas (ThemeManager: Light / Dark mode).
 *  - Verificar que el usuario tenga un token válido con rol 'admin' (server-side).
 *  - Redirección limpia al login admin.
 *  - Proveer logout limpio (elimina tokens + historial de sesión).
 *  - Exponer datos del admin autenticado (nombre, email, initials).
 *  - Manejo de toggle del sidebar en dispositivos móviles.
 */

export const ThemeManager = {
  THEME_KEY: "admin_theme",

  getTheme() {
    const saved = localStorage.getItem(this.THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "dark";
    }
    return "light";
  },

  setTheme(theme) {
    if (theme !== "light" && theme !== "dark") return;
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(this.THEME_KEY, theme);
    this.updateToggleButtons(theme);
    window.dispatchEvent(
      new CustomEvent("admin:theme-changed", { detail: { theme } }),
    );
  },

  toggleTheme() {
    const current = this.getTheme();
    const next = current === "dark" ? "light" : "dark";
    this.setTheme(next);
  },

  updateToggleButtons(theme) {
    const isDark = theme === "dark";
    const buttons = document.querySelectorAll(".adm-theme-toggle");
    buttons.forEach((btn) => {
      btn.setAttribute(
        "aria-label",
        isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro",
      );
      btn.setAttribute(
        "title",
        isDark ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro",
      );
      btn.innerHTML = isDark
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
    });
  },

  init() {
    const theme = this.getTheme();
    this.setTheme(theme);

    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".adm-theme-toggle");
      if (btn) {
        this.toggleTheme();
      }
    });

    if (window.matchMedia) {
      window
        .matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", (e) => {
          if (!localStorage.getItem(this.THEME_KEY)) {
            this.setTheme(e.matches ? "dark" : "light");
          }
        });
    }
  },
};

ThemeManager.init();

function getToken() {
  const val = localStorage.getItem("accessToken");
  if (!val || val === "undefined" || val === "null") return null;
  return val;
}

function decodeJwt(token) {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

function isTokenExpired(payload) {
  if (!payload?.exp) return false;
  return Date.now() >= payload.exp * 1000;
}

function resolveLoginPath() {
  const pathname = window.location.pathname;
  const idx = pathname.indexOf("/frontend/");
  if (idx !== -1) {
    return pathname.substring(0, idx) + "/frontend/pages/admin/login.html";
  }
  return "/frontend/pages/admin/login.html";
}

function resolveDashboardPath() {
  const pathname = window.location.pathname;
  const idx = pathname.indexOf("/frontend/");
  if (idx !== -1) {
    return pathname.substring(0, idx) + "/frontend/pages/admin/dashboard.html";
  }
  return "/frontend/pages/admin/dashboard.html";
}

function resolveCommonLoginPath() {
  const pathname = window.location.pathname;
  const idx = pathname.indexOf("/frontend/");
  if (idx !== -1) {
    return pathname.substring(0, idx) + "/frontend/index.html";
  }
  if (pathname.endsWith("/frontend")) {
    return pathname + "/index.html";
  }
  return "/frontend/index.html";
}

export const AdminSession = {
  getPayload() {
    const token = getToken();
    if (!token) return null;
    const payload = decodeJwt(token);
    if (!payload) return null;
    if (isTokenExpired(payload)) return null;
    return payload;
  },

  isAdminLoggedIn() {
    const payload = this.getPayload();
    if (!payload) return false;
    const roleName = (payload.role_name ?? payload.role ?? "").toLowerCase();
    return roleName === "admin";
  },

  getAdminUser() {
    const payload = this.getPayload();
    if (!payload) return null;
    const firstName = payload.first_name ?? "";
    const lastName = payload.last_name ?? "";
    const email = payload.email ?? "";
    const initials = this._buildInitials(email, firstName, lastName);
    const displayName =
      firstName && lastName ? `${firstName} ${lastName}` : email.split("@")[0];
    return {
      id: payload.id ?? payload.sub,
      email,
      role_name: payload.role_name ?? payload.role ?? "Admin",
      initials,
      displayName,
    };
  },

  _buildInitials(email, first, last) {
    if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
    if (first) return first.slice(0, 2).toUpperCase();
    return email.slice(0, 2).toUpperCase();
  },

  saveSession({ accessToken, refreshToken }) {
    if (accessToken) localStorage.setItem("accessToken", accessToken);
    if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
  },

  logout() {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    window.location.replace(resolveCommonLoginPath());
  },
};

export function requireAdminAuth() {
  if (!AdminSession.isAdminLoggedIn()) {
    console.warn(
      "[AdminAuth] Sin sesión admin válida. Redirigiendo al login...",
    );
    window.location.replace(resolveLoginPath());
    throw new Error("Redirect en progreso");
  }
  return AdminSession.getAdminUser();
}

export function redirectIfAlreadyLogged() {
  if (AdminSession.isAdminLoggedIn()) {
    window.location.replace(resolveDashboardPath());
  }
}

export function fillSidebarUser(user) {
  const avatarEl = document.getElementById("sidebarUserAvatar");
  const nameEl = document.getElementById("sidebarUserName");
  const emailEl = document.getElementById("sidebarUserEmail");
  const logoutBtn = document.getElementById("sidebarLogoutBtn");

  if (avatarEl) avatarEl.textContent = user.initials ?? "AD";
  if (nameEl) nameEl.textContent = user.displayName ?? "Administrador";
  if (emailEl) emailEl.textContent = user.email ?? "";
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => AdminSession.logout());
  }
}

export function initSidebarToggle() {
  const menuBtn = document.getElementById("menuToggleBtn");
  const sidebar = document.getElementById("adminSidebar");
  const overlay = document.getElementById("sidebarOverlay");

  function openSidebar() {
    sidebar?.classList.add("open");
    overlay?.classList.add("show");
    document.body.style.overflow = "hidden";
  }

  function closeSidebar() {
    sidebar?.classList.remove("open");
    overlay?.classList.remove("show");
    document.body.style.overflow = "";
  }

  menuBtn?.addEventListener("click", openSidebar);
  overlay?.addEventListener("click", closeSidebar);
  sidebar?.querySelectorAll(".adm-nav-item").forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 768) {
        closeSidebar();
      }
    });
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 768) closeSidebar();
  });
}

export function setActiveNavItem() {
  const currentPath = window.location.pathname;
  document.querySelectorAll(".adm-nav-item").forEach((item) => {
    const href = item.getAttribute("href") ?? "";
    if (href && currentPath.endsWith(href.replace(/^\.\.\/+/, ""))) {
      item.classList.add("active");
    }
  });
}

let toastContainer = null;

function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement("div");
    toastContainer.className = "adm-toast-container";
    toastContainer.id = "admToastContainer";
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

function toastIcon(type) {
  const icons = {
    success: `<svg class="adm-toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error: `<svg class="adm-toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    info: `<svg class="adm-toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    warning: `<svg class="adm-toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  };
  return icons[type] ?? icons.info;
}

export const admToast = {
  show(message, type = "info", duration = 4000) {
    const container = getToastContainer();
    const toast = document.createElement("div");
    toast.className = `adm-toast adm-toast--${type}`;
    toast.innerHTML = `
      ${toastIcon(type)}
      <span class="adm-toast__msg">${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add("leaving");
      toast.addEventListener("animationend", () => toast.remove(), {
        once: true,
      });
    }, duration);
  },
  success(msg) {
    this.show(msg, "success");
  },
  error(msg) {
    this.show(msg, "error", 5000);
  },
  info(msg) {
    this.show(msg, "info");
  },
  warning(msg) {
    this.show(msg, "warning");
  },
};
