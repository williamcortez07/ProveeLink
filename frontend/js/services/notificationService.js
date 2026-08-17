/**
 * @file notificationService.js
 * @description Sistema de notificaciones Toast premium.
 * Implementa un servicio singleton con una cola de mensajes,
 * microinteracciones (fade/slide) y estados semánticos de UI.
 *
 * USO:
 *   import { notify } from './notificationService.js';
 *   notify.success('Bienvenido de vuelta');
 *   notify.error('Credenciales incorrectas');
 *   notify.warning('Tu sesión expirará pronto');
 *   notify.info('Te enviamos un código a tu correo');
 */

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────────────────────

const TOAST_DURATION_MS = 4000; // Duración visible por defecto
const TOAST_ANIM_MS = 400; // Duración de animación de entrada/salida
const MAX_TOASTS = 4; // Máximo de toasts visibles simultáneamente

/** Mapa de variantes con icono SVG, colores y etiqueta ARIA */
const VARIANTS = {
  success: {
    label: "Éxito",
    color: "#22c55e",
    bg: "rgba(22,163,74,0.12)",
    border: "rgba(22,163,74,0.35)",
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  },
  error: {
    label: "Error",
    color: "#f87171",
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.35)",
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  },
  warning: {
    label: "Advertencia",
    color: "#fbbf24",
    bg: "rgba(251,191,36,0.12)",
    border: "rgba(251,191,36,0.35)",
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  },
  info: {
    label: "Información",
    color: "#60a5fa",
    bg: "rgba(96,165,250,0.12)",
    border: "rgba(96,165,250,0.35)",
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// GESTIÓN DEL CONTENEDOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Obtiene o crea el contenedor raíz de los toasts en el DOM.
 * @returns {HTMLElement}
 */
function getOrCreateContainer() {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.setAttribute("role", "region");
    container.setAttribute("aria-label", "Notificaciones");
    container.setAttribute("aria-live", "polite");

    // Estilos del contenedor (inyectados una sola vez)
    Object.assign(container.style, {
      position: "fixed",
      bottom: "24px",
      right: "24px",
      zIndex: "99999",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
      pointerEvents: "none",
    });

    document.body.appendChild(container);
    injectToastStyles();
  }
  return container;
}

/**
 * Inyecta los estilos CSS para toasts y animaciones una única vez.
 */
function injectToastStyles() {
  if (document.getElementById("toast-styles")) return;

  const style = document.createElement("style");
  style.id = "toast-styles";
  style.textContent = `
    @keyframes toast-slide-in {
      from { opacity: 0; transform: translateX(110%) scale(0.9); }
      to   { opacity: 1; transform: translateX(0)   scale(1); }
    }
    @keyframes toast-slide-out {
      from { opacity: 1; transform: translateX(0)   scale(1) translateY(0); max-height: 100px; }
      to   { opacity: 0; transform: translateX(110%) scale(0.9) translateY(8px); max-height: 0; padding: 0; margin: 0; }
    }
    .toast-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 18px;
      border-radius: 14px;
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.12);
      pointer-events: all;
      cursor: pointer;
      min-width: 280px;
      max-width: 360px;
      animation: toast-slide-in ${TOAST_ANIM_MS}ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
      font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
      overflow: hidden;
      will-change: transform, opacity;
      position: relative;
    }
    .toast-item.leaving {
      animation: toast-slide-out ${TOAST_ANIM_MS}ms cubic-bezier(0.7, 0, 1, 0.6) forwards;
    }
    .toast-icon {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      margin-top: 1px;
    }
    .toast-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .toast-label {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      opacity: 0.7;
    }
    .toast-message {
      font-size: 0.88rem;
      font-weight: 500;
      line-height: 1.45;
      color: #f1f5f9;
    }
    .toast-close {
      background: none;
      border: none;
      cursor: pointer;
      color: rgba(255,255,255,0.45);
      padding: 2px;
      line-height: 1;
      flex-shrink: 0;
      transition: color 0.15s;
      margin-top: -2px;
    }
    .toast-close:hover { color: rgba(255,255,255,0.85); }
    .toast-progress {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 3px;
      border-radius: 0 0 14px 14px;
      animation: toast-progress linear forwards;
    }
    @keyframes toast-progress {
      from { width: 100%; }
      to   { width: 0%; }
    }
  `;
  document.head.appendChild(style);
}

// ─────────────────────────────────────────────────────────────────────────────
// LÓGICA PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crea y muestra un toast en pantalla.
 * @param {string} message   - Texto del mensaje.
 * @param {'success'|'error'|'warning'|'info'} type - Variante visual.
 * @param {number} [duration=TOAST_DURATION_MS] - Duración en ms.
 */
function showToast(message, type = "info", duration = TOAST_DURATION_MS) {
  const container = getOrCreateContainer();
  const variant = VARIANTS[type] || VARIANTS.info;

  // Limita el número de toasts visibles
  while (container.children.length >= MAX_TOASTS) {
    dismissToast(container.firstChild);
  }

  const toast = document.createElement("div");
  toast.className = "toast-item";
  toast.setAttribute("role", "alert");
  toast.setAttribute("aria-label", `${variant.label}: ${message}`);

  Object.assign(toast.style, {
    background: variant.bg,
    borderColor: variant.border,
    color: variant.color,
  });

  toast.innerHTML = `
    <div class="toast-icon" style="background: ${variant.border}; color: ${variant.color}">
      ${variant.icon}
    </div>
    <div class="toast-body">
      <span class="toast-label" style="color: ${variant.color}">${variant.label}</span>
      <span class="toast-message">${message}</span>
    </div>
    <button class="toast-close" aria-label="Cerrar notificación">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
    <div class="toast-progress" style="background: ${variant.color}; animation-duration: ${duration}ms;"></div>
  `;

  // Cerrar al hacer clic
  toast.addEventListener("click", () => dismissToast(toast));

  container.appendChild(toast);

  // Auto-dismiss después del tiempo configurado
  const timer = setTimeout(() => dismissToast(toast), duration);
  toast._dismissTimer = timer;
}

/**
 * Anima la salida y elimina un toast del DOM.
 * @param {HTMLElement} toast
 */
function dismissToast(toast) {
  if (!toast || toast._dismissed) return;
  toast._dismissed = true;
  clearTimeout(toast._dismissTimer);
  toast.classList.add("leaving");
  toast.addEventListener("animationend", () => toast.remove(), { once: true });
}

/**
 * Servicio público de notificaciones.
 * @namespace notify
 */
export const notify = {
  /** @param {string} msg @param {number} [ms] */
  success: (msg, ms) => showToast(msg, "success", ms),
  /** @param {string} msg @param {number} [ms] */
  error: (msg, ms) => showToast(msg, "error", ms),
  /** @param {string} msg @param {number} [ms] */
  warning: (msg, ms) => showToast(msg, "warning", ms),
  /** @param {string} msg @param {number} [ms] */
  warn: (msg, ms) => showToast(msg, "warning", ms),
  /** @param {string} msg @param {number} [ms] */
  info: (msg, ms) => showToast(msg, "info", ms),
};

export const NotificationManager = notify;

