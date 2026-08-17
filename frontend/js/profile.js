/**
 * @file profile.js
 * @description Módulo de perfil de usuario autenticado.
 * Responsabilidades: cargar datos del usuario por ID desde la API,
 * renderizar la vista, gestionar el modal de edición y la desactivación de cuenta.
 */

import { TokenManager } from "./services/api.js";
import { profileApi } from "./services/api.js";
import { Router } from "./services/routes.js";
import { notify } from "./services/notificationService.js";
import { uploadProfilePicture } from "./services/storageService.js";

/**
 * Formatea una fecha ISO a una cadena legible en español.
 * @param {string|null} isoString
 * @returns {string}
 */
function formatDate(isoString) {
  if (!isoString) return "—";
  try {
    return new Intl.DateTimeFormat("es-NI", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

/**
 * Capitaliza la primera letra de cada palabra.
 * @param {string} str
 * @returns {string}
 */
const titleCase = (str) =>
  str ? str.replace(/\b\w/g, (c) => c.toUpperCase()) : "—";

// ─────────────────────────────────────────────────────────────────────────────
// RENDER HELPERS — generan HTML parcial
// ─────────────────────────────────────────────────────────────────────────────

function renderAvatar(url, name) {
  if (url) {
    return `<img class="profile-avatar" src="${url}" alt="Foto de perfil de ${name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
            <div class="profile-avatar-placeholder" style="display:none">
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>`;
  }
  return `<div class="profile-avatar-placeholder">
    <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  </div>`;
}

function renderStatusBadge(status) {
  const isActive = status?.toLowerCase() === "active";
  return `<span class="profile-status-badge profile-status-badge--${isActive ? "active" : "inactive"}">
    <span class="profile-status-dot"></span>
    ${isActive ? "Activo" : "Inactivo"}
  </span>`;
}

function renderDataRow(iconSvg, tintClass, label, value, isHtml = false) {
  const displayValue = isHtml
    ? value
    : `<span class="${value ? "profile-data-value" : "profile-data-value profile-data-value--muted"}">${value || "Sin registrar"}</span>`;

  return `<div class="profile-data-row">
    <div class="profile-data-row-icon ${tintClass}">${iconSvg}</div>
    <div class="profile-data-row-content">
      <p class="profile-data-label">${label}</p>
      ${displayValue}
    </div>
  </div>`;
}

// SVGs reutilizables temporalmete aqui
const SVG = {
  email: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
  phone: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.71 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.59a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
  role: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  calendar: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  clock: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  shield: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  lock: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  heart: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  edit: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  camera: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
  building: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 12h6M9 15h6"/></svg>`,
  arrow: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`,
  trash: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
};

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE RENDERER
// ─────────────────────────────────────────────────────────────────────────────

function renderProfile(user) {
  const fullName = `${titleCase(user.first_name)} ${titleCase(user.last_name)}`;

  return `
    <!-- ── HERO ── -->
    <div class="profile-hero">
      <div class="profile-avatar-wrap">
        ${renderAvatar(user.profile_picture_url, fullName)}
        <button class="profile-avatar-edit-btn" id="btnEditAvatar" aria-label="Cambiar foto de perfil">
          ${SVG.camera}
        </button>
      </div>
      <h1 class="profile-hero-name">${fullName}</h1>
      <span class="profile-hero-role">
        <span class="profile-status-dot"></span>
        ${user.role_name ?? "Usuario"}
      </span>
    </div>

    <!-- ── BODY ── -->
    <div class="profile-body">

      <!-- Acciones rápidas -->
      <div class="profile-actions-grid">
        <button class="profile-action-btn" id="btnOpenEditModal" aria-label="Editar perfil">
          <div class="profile-action-icon profile-action-icon--blue">${SVG.edit}</div>
          <span>Editar perfil</span>
        </button>
        <a class="profile-action-btn" href="/pages/favorites.html" aria-label="Mis favoritos">
          <div class="profile-action-icon profile-action-icon--green">${SVG.heart}</div>
          <span>Favoritos</span>
        </a>
        <button class="profile-action-btn" id="btnOpenSecurityModal" aria-label="Seguridad">
          <div class="profile-action-icon profile-action-icon--purple">${SVG.shield}</div>
          <span>Seguridad</span>
        </button>
      </div>

      <!-- Información personal -->
      <div class="profile-section">
        <div class="profile-section-header">
          <div class="profile-section-icon" style="background:var(--tint-blue);color:var(--color-accent-blue)">${SVG.edit}</div>
          <span class="profile-section-title">Información personal</span>
          <button class="profile-section-link" id="btnEditInfo">Editar</button>
        </div>
        <div class="profile-data-list">
          ${renderDataRow(SVG.email, "style='background:var(--tint-blue);color:var(--color-accent-blue)'", "Correo electrónico", user.email)}
          ${renderDataRow(SVG.phone, "style='background:var(--tint-green);color:var(--color-primary-green)'", "Teléfono", user.phone)}
          ${renderDataRow(SVG.role, "style='background:var(--tint-purple);color:#9333ea'", "Rol", titleCase(user.role_name))}
        </div>
      </div>

      <!-- Seguridad y privacidad -->
      <div class="profile-section">
        <div class="profile-section-header">
          <div class="profile-section-icon" style="background:var(--tint-purple);color:#9333ea">${SVG.shield}</div>
          <span class="profile-section-title">Seguridad y privacidad</span>
          <button class="profile-section-link" id="btnChangePassword">Cambiar</button>
        </div>
        <div class="profile-data-list">
          ${renderDataRow(SVG.lock, "style='background:var(--tint-orange);color:#ea580c'", "Contraseña", "••••••••")}
          ${renderDataRow(SVG.clock, "style='background:var(--tint-blue);color:var(--color-accent-blue)'", "Último acceso", formatDate(user.last_login_at))}
          ${renderDataRow(SVG.calendar, "style='background:var(--tint-green);color:var(--color-primary-green)'", "Datos actualizados", formatDate(user.updated_at))}
          ${renderDataRow(SVG.calendar, "style='background:var(--color-border-subtle);color:var(--color-text-muted)'", "Miembro desde", formatDate(user.created_at))}
          <div class="profile-data-row">
            <div class="profile-data-row-icon" style="background:var(--tint-green);color:var(--color-primary-green)">${SVG.shield}</div>
            <div class="profile-data-row-content">
              <p class="profile-data-label">Estado de la cuenta</p>
              ${renderStatusBadge(user.status)}
            </div>
          </div>
        </div>
      </div>

      <!-- CTA: ¿Tienes un negocio? -->
      <a class="profile-business-cta" href="/pages/company/createCompany.html" id="linkCreateCompany">
        <div class="profile-business-cta-icon">${SVG.building}</div>
        <div class="profile-business-cta-body">
          <p class="profile-business-cta-title">¿Tienes un negocio?</p>
          <p class="profile-business-cta-sub">Regístralo en ProveeLink y conecta con miles de clientes</p>
        </div>
        <div class="profile-business-cta-arrow">${SVG.arrow}</div>
      </a>

      <!-- Zona de peligro -->
      <div class="profile-section">
        <div class="profile-section-header">
          <div class="profile-section-icon" style="background:rgba(239,68,68,.1);color:#dc2626">${SVG.trash}</div>
          <span class="profile-section-title">Zona de peligro</span>
        </div>
        <div class="profile-danger-zone">
          <div class="profile-danger-info">
            <p class="profile-danger-title">Desactivar cuenta</p>
            <p class="profile-danger-sub">Tu cuenta se marcará como inactiva. Podrás reactivarla contactando soporte.</p>
          </div>
          <button class="btn-danger-outline" id="btnDeactivate">Desactivar</button>
        </div>
      </div>

    </div>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL DE EDICIÓN
// ─────────────────────────────────────────────────────────────────────────────

function buildEditModal(user) {
  const overlay = document.createElement("div");
  overlay.id = "profileEditModal";
  overlay.className = "profile-modal-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "editModalTitle");

  overlay.innerHTML = `
    <div class="profile-modal">
      <div class="profile-modal-handle"></div>
      <h2 class="profile-modal-title" id="editModalTitle">Editar perfil</h2>

      <form id="editProfileForm" novalidate>
        <div class="profile-form-group">
          <label class="profile-form-label" for="inp-firstName">Nombre</label>
          <input class="profile-form-input" id="inp-firstName" type="text" value="${user.first_name ?? ""}" autocomplete="given-name" required>
        </div>
        <div class="profile-form-group">
          <label class="profile-form-label" for="inp-lastName">Apellidos</label>
          <input class="profile-form-input" id="inp-lastName" type="text" value="${user.last_name ?? ""}" autocomplete="family-name" required>
        </div>
        <div class="profile-form-group">
          <label class="profile-form-label" for="inp-email">Correo electrónico</label>
          <input class="profile-form-input" id="inp-email" type="email" value="${user.email ?? ""}" autocomplete="email" required>
        </div>
        <div class="profile-form-group">
          <label class="profile-form-label" for="inp-phone">Teléfono</label>
          <input class="profile-form-input" id="inp-phone" type="tel" value="${user.phone ?? ""}" autocomplete="tel">
        </div>
        <div class="profile-form-actions">
          <button type="button" class="btn btn-light-subtle" id="btnCancelEdit" style="flex:1">Cancelar</button>
          <button type="submit" class="btn btn-green-solid" id="btnSaveEdit" style="flex:1">Guardar cambios</button>
        </div>
      </form>
    </div>
  `;
  return overlay;
}

function buildSecurityModal(user) {
  const overlay = document.createElement("div");
  overlay.id = "profileSecurityModal";
  overlay.className = "profile-modal-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "secModalTitle");

  overlay.innerHTML = `
    <div class="profile-modal">
      <div class="profile-modal-handle"></div>
      <h2 class="profile-modal-title" id="secModalTitle">Cambiar contraseña</h2>

      <form id="changePasswordForm" novalidate>
        <div class="profile-form-group">
          <label class="profile-form-label" for="inp-newPassword">Nueva contraseña</label>
          <input class="profile-form-input" id="inp-newPassword" type="password" placeholder="Mín. 8 chars, 1 mayúscula, 1 número, 1 símbolo" autocomplete="new-password" required>
        </div>
        <div class="profile-form-group">
          <label class="profile-form-label" for="inp-confirmPassword">Confirmar contraseña</label>
          <input class="profile-form-input" id="inp-confirmPassword" type="password" placeholder="Repite la contraseña" autocomplete="new-password" required>
        </div>

        <div class="profile-form-actions">
          <button type="button" class="btn btn-light-subtle" id="btnCancelSecurity" style="flex:1">Cancelar</button>
          <button type="submit" class="btn btn-green-solid" id="btnSaveSecurity" style="flex:1">Actualizar</button>
        </div>
      </form>
    </div>
  `;
  return overlay;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLLER
// ─────────────────────────────────────────────────────────────────────────────

const ProfileController = {
  _user: null,

  async init() {
    // Guard: sesión válida
    const session = Router.init();
    if (!session) return;

    const container = document.getElementById("profileContent");
    if (!container) return;

    this._renderSkeleton(container);

    try {
      const response = await profileApi.getById(session.user.id);
      // La API devuelve { data: [...], meta: {...} }
      const userData = Array.isArray(response?.data)
        ? response.data[0]
        : (response?.data ?? response);

      if (!userData) throw new Error("No se encontraron datos del usuario.");

      this._user = userData;
      container.innerHTML = renderProfile(userData);
      this._bindEvents(session.user.id);
    } catch (err) {
      console.error("[Profile] Error al cargar perfil:", err);
      container.innerHTML = `
        <div class="empty-state-billboard">
          <p class="text-muted">No se pudo cargar tu perfil. Intenta de nuevo más tarde.</p>
        </div>`;
    }
  },

  _renderSkeleton(container) {
    container.innerHTML = `
      <div class="profile-hero" style="display:flex;flex-direction:column;align-items:center;gap:12px">
        <div class="skeleton-block" style="width:96px;height:96px;border-radius:50%"></div>
        <div class="skeleton-block" style="width:160px;height:20px"></div>
        <div class="skeleton-block" style="width:90px;height:16px"></div>
      </div>
      <div style="padding:24px 16px;display:flex;flex-direction:column;gap:12px">
        <div class="skeleton-block" style="height:120px;border-radius:var(--radius-large)"></div>
        <div class="skeleton-block" style="height:180px;border-radius:var(--radius-large)"></div>
        <div class="skeleton-block" style="height:80px;border-radius:var(--radius-large)"></div>
      </div>`;
  },

  _bindEvents(userId) {
    // Abrir modal edición (botón superior + enlace "Editar" en sección)
    document
      .getElementById("btnOpenEditModal")
      ?.addEventListener("click", () => this._openEditModal());
    document
      .getElementById("btnEditInfo")
      ?.addEventListener("click", () => this._openEditModal());

    // ── Avatar: file picker nativo ────────────────────────────────────────────
    const fileInput = this._injectFileInput();
    document
      .getElementById("btnEditAvatar")
      ?.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      this._handleAvatarUpload(file, userId);
      fileInput.value = ""; // permite re-seleccionar el mismo archivo
    });

    // Abrir modal seguridad
    document
      .getElementById("btnOpenSecurityModal")
      ?.addEventListener("click", () => this._openSecurityModal());
    document
      .getElementById("btnChangePassword")
      ?.addEventListener("click", () => this._openSecurityModal());

    // Desactivar cuenta
    document
      .getElementById("btnDeactivate")
      ?.addEventListener("click", () => this._handleDeactivate(userId));
  },

  // ── Edit modal ─────────────────────────────────────────────────────────────

  _openEditModal() {
    document.getElementById("profileEditModal")?.remove();
    const modal = buildEditModal(this._user);
    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) this._closeModal("profileEditModal");
    });
    document
      .getElementById("btnCancelEdit")
      ?.addEventListener("click", () => this._closeModal("profileEditModal"));
    document
      .getElementById("editProfileForm")
      ?.addEventListener("submit", (e) => {
        e.preventDefault();
        this._handleSaveProfile(TokenManager.getUser()?.id);
      });
  },

  async _handleSaveProfile(userId) {
    const payload = {
      first_name: document.getElementById("inp-firstName")?.value.trim(),
      last_name: document.getElementById("inp-lastName")?.value.trim(),
      email: document.getElementById("inp-email")?.value.trim(),
      phone: document.getElementById("inp-phone")?.value.trim() || undefined,
      profile_picture_url: this._user?.profile_picture_url ?? undefined,
    };
    Object.keys(payload).forEach(
      (k) => payload[k] === undefined && delete payload[k],
    );

    if (!payload.first_name || !payload.last_name || !payload.email) {
      notify.warning("Nombre, apellidos y correo son obligatorios.");
      return;
    }

    const btn = document.getElementById("btnSaveEdit");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Guardando…";
    }

    try {
      await profileApi.update(userId, payload);
      notify.success("Perfil actualizado correctamente.");
      this._closeModal("profileEditModal");
      await this.init();
    } catch (err) {
      notify.error(err.message || "No se pudo actualizar el perfil.");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Guardar cambios";
      }
    }
  },

  // ── Security modal ─────────────────────────────────────────────────────────

  _openSecurityModal() {
    document.getElementById("profileSecurityModal")?.remove();
    const modal = buildSecurityModal(this._user);
    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) this._closeModal("profileSecurityModal");
    });
    document
      .getElementById("btnCancelSecurity")
      ?.addEventListener("click", () =>
        this._closeModal("profileSecurityModal"),
      );
    document
      .getElementById("changePasswordForm")
      ?.addEventListener("submit", (e) => {
        e.preventDefault();
        this._handleChangePassword(TokenManager.getUser()?.id);
      });
  },

  async _handleChangePassword(userId) {
    const newPass = document.getElementById("inp-newPassword")?.value;
    const confirmPass = document.getElementById("inp-confirmPassword")?.value;

    if (!newPass || newPass.length < 8) {
      notify.warning("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (newPass !== confirmPass) {
      notify.warning("Las contraseñas no coinciden.");
      return;
    }

    const btn = document.getElementById("btnSaveSecurity");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Actualizando…";
    }

    try {
      await profileApi.update(userId, { password: newPass });
      notify.success("Contraseña actualizada correctamente.");
      this._closeModal("profileSecurityModal");
    } catch (err) {
      notify.error(err.message || "No se pudo actualizar la contraseña.");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Actualizar";
      }
    }
  },

  // ── Deactivate ─────────────────────────────────────────────────────────────

  async _handleDeactivate(userId) {
    const confirmed = window.confirm(
      "¿Estás seguro de desactivar tu cuenta? Tu sesión se cerrará automáticamente.",
    );
    if (!confirmed) return;

    try {
      await profileApi.deactivate(userId);
      notify.info("Cuenta desactivada. Cerrando sesión…");
      setTimeout(() => TokenManager.logout(), 1500);
    } catch (err) {
      notify.error(err.message || "No se pudo desactivar la cuenta.");
    }
  },

  // ── Shared ─────────────────────────────────────────────────────────────────

  //
  // ── Avatar upload ───────────────────────────────────────────────────────────

  /**
   * Crea e inyecta un <input type="file"> oculto en el body (singleton).
   * @returns {HTMLInputElement}
   */
  _injectFileInput() {
    const existing = document.getElementById("avatarFileInput");
    if (existing) return existing;

    const input = document.createElement("input");
    input.type = "file";
    input.id = "avatarFileInput";
    input.accept = "image/jpeg,image/png,image/webp,image/gif";
    input.style.display = "none";
    input.setAttribute("aria-hidden", "true");
    document.body.appendChild(input);
    return input;
  },

  /**
   * @param {File}   file
   * @param {string} userId
   */
  async _handleAvatarUpload(file, userId) {
    const avatarImg = document.querySelector(".profile-avatar");
    const editBtn = document.getElementById("btnEditAvatar");
    const prevSrc = avatarImg?.src ?? "";

    // 1. Preview optimista inmediato
    const previewUrl = URL.createObjectURL(file);
    if (avatarImg) avatarImg.src = previewUrl;
    if (editBtn) editBtn.style.opacity = "0.5";

    notify.info("Subiendo foto de perfil…");

    try {
      // 2. Subir a Supabase Storage → obtener URL pública permanente
      const publicUrl = await uploadProfilePicture(file, userId);
      console.info("[Profile] Foto subida a Supabase. URL pública:", publicUrl);

      // 3. Construir payload completo con datos actuales del usuario.
      const updatePayload = {
        first_name: this._user?.first_name ?? undefined,
        last_name: this._user?.last_name ?? undefined,
        email: this._user?.email ?? undefined,
        phone: this._user?.phone ?? undefined,
        profile_picture_url: publicUrl,
      };

      // Elimina claves undefined antes de enviar (no queremos sobreescribir con vacíos)
      // por ejemplo si la url es null se inserta asi en la base de datos y recarga sin ft de perfil
      Object.keys(updatePayload).forEach(
        (k) => updatePayload[k] === undefined && delete updatePayload[k],
      );

      console.info(
        `[Profile]  PATCH /users/${userId} — payload:`,
        JSON.stringify(updatePayload, null, 2),
      );

      // 4. Llamar al endpoint PATCH /users/:id
      const response = await profileApi.update(userId, updatePayload);
      console.info("[Profile] Respuesta del servidor:", response);

      // 5. Actualizar estado interno del módulo
      if (this._user) this._user.profile_picture_url = publicUrl;

      notify.success("¡Foto de perfil actualizada correctamente!");
    } catch (err) {
      // Revertir preview si algo falló
      if (avatarImg) avatarImg.src = prevSrc;
      const msg = err.message || "No se pudo guardar la imagen.";
      notify.error(`Error: ${msg}`);
      console.error("[Profile]  Error en _handleAvatarUpload:", {
        userId,
        error: err,
        status: err.status,
        data: err.data,
      });
    } finally {
      if (editBtn) editBtn.style.opacity = "1";
      URL.revokeObjectURL(previewUrl);
    }
  },

  // ── Shared ─────────────────────────────────────────────────────────────────

  _closeModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.animation = "fadeIn .15s ease reverse";
    setTimeout(() => el.remove(), 150);
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  ProfileController.init();
});
