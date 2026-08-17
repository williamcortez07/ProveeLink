/**
 * @file company.js
 * @description Módulo principal del panel de empresa (HomeCompany).
 *
 * Responsabilidades (SRP):
 *  1. Verificar sesión activa.
 *  2. Verificar que el usuario tiene una empresa registrada (vía API).
 *  3. Si el token JWT aún tiene rol "Cliente" pero el usuario ya tiene empresa,
 *     solicitar tokens frescos vía POST /auth/upgrade-role (fallback).
 *  4. Renderizar la información de la empresa.
 *  5. Proveer acceso al flujo de Suppliers.
 *  6. Detectar si el usuario viene de un registro recién completado
 *     (señal de sessionStorage "company_just_created").
 */

import { TokenManager, RoleManager, ROLES } from "../services/api.js";
import { companyService } from "../services/companyService.js";
import { supplierService } from "../services/supplierService.js";
import { notify } from "../services/notificationService.js";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES DE NAVEGACIÓN
// ─────────────────────────────────────────────────────────────────────────────

/** Ruta al login (desde pages/company/) */
const LOGIN_PATH = "../../index.html";
/** Ruta a la vista de suppliers (a implementar) */
const SUPPLIERS_PATH = "../supplier/homeSupplier.html";

// ─────────────────────────────────────────────────────────────────────────────
// RENDERIZADO DE EMPRESA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estado de verificación → etiqueta visual.
 * @param {string} status
 * @returns {{ label: string, color: string }}
 */
function getVerificationBadge(status) {
  const map = {
    pending:  { label: "Pendiente de verificación", color: "#f59e0b" },
    verified: { label: "Verificada",                 color: "#22c55e" },
    rejected: { label: "Rechazada",                  color: "#ef4444" },
  };
  return map[status] ?? { label: status, color: "#64748b" };
}

/**
 * Formatea una fecha ISO a formato legible.
 * @param {string} isoDate
 * @returns {string}
 */
function formatDate(isoDate) {
  try {
    return new Intl.DateTimeFormat("es", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(isoDate));
  } catch {
    return isoDate ?? "—";
  }
}

/**
 * Renderiza los datos de la empresa en el contenedor principal.
 * @param {object} company - Objeto de empresa de la API.
 */
function renderCompanyCard(company) {
  const container = document.getElementById("companyContent");
  if (!container) return;

  const badge = getVerificationBadge(company.verification_status);
  const logo  = company.logo_url
    ? `<img src="${company.logo_url}" alt="Logo de ${company.name}" class="company-logo-img" />`
    : `<div class="company-logo-placeholder" aria-hidden="true">
         <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
       </div>`;

  container.innerHTML = `
    <div class="company-card">

      <!-- Encabezado de empresa -->
      <div class="company-card__header">
        <div class="company-card__logo">${logo}</div>
        <div class="company-card__header-info">
          <h2 class="company-card__name">${company.name}</h2>
          <span class="company-card__badge" style="color: ${badge.color}; background: ${badge.color}22; border: 1px solid ${badge.color}44;">
            ${badge.label}
          </span>
          ${company.website_url
            ? `<a href="${company.website_url}" target="_blank" rel="noopener noreferrer" class="company-card__website">
                 ${company.website_url}
               </a>`
            : ""}
        </div>
      </div>

      <!-- Descripción -->
      ${company.description
        ? `<p class="company-card__description">${company.description}</p>`
        : ""}

      <!-- Datos de contacto y ubicación -->
      <div class="company-card__details">
        ${company.email
          ? `<div class="company-detail-row">
               <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
               <span>${company.email}</span>
             </div>`
          : ""}
        ${company.phone
          ? `<div class="company-detail-row">
               <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 1.13 2.18 2 2 0 0 1 3.11 0h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 7.91"/></svg>
               <span>${company.phone}</span>
             </div>`
          : ""}
        ${(company.city || company.state_province)
          ? `<div class="company-detail-row">
               <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
               <span>${[company.city, company.state_province].filter(Boolean).join(", ")}</span>
             </div>`
          : ""}
        ${company.tax_id
          ? `<div class="company-detail-row">
               <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
               <span>ID Fiscal: ${company.tax_id}</span>
             </div>`
          : ""}
        <div class="company-detail-row">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span>Registrada el ${formatDate(company.created_at)}</span>
        </div>
      </div>

      <!-- CTA → Suppliers -->
      <div class="company-card__actions">
        <a
          href="${SUPPLIERS_PATH}"
          id="btn-go-to-suppliers"
          class="btn btn-green-solid company-btn-suppliers"
          aria-label="Gestionar proveedores de ${company.name}"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
            <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
          </svg>
          Gestionar Proveedores
        </a>
      </div>

    </div>
  `;
}

/**
 * Renderiza el estado vacío cuando no se encontró empresa.
 * Muestra el CTA para registrar empresa.
 */
function renderNoCompany() {
  const container = document.getElementById("companyContent");
  if (!container) return;

  container.innerHTML = `
    <div class="empty-state-billboard">
      <div class="empty-state-showcase-box">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" stroke-width="1.5">
          <rect x="2" y="7" width="20" height="14" rx="2"/>
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
        </svg>
        <div class="badge-lock-overlap" aria-hidden="true"></div>
      </div>
      <h2 class="heading-md" style="margin-bottom: 8px;">Aún no tienes empresa</h2>
      <p class="text-muted" style="margin-bottom: 24px; max-width: 280px;">
        Registra tu empresa para comenzar a conectar con proveedores en ProveeLink.
      </p>
      <a href="./createCompany.html" class="btn btn-green-solid" id="cta-create-company">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Registrar mi empresa
      </a>
    </div>
  `;
}

/**
 * Renderiza estado de carga inicial.
 */
function renderLoading() {
  const container = document.getElementById("companyContent");
  if (!container) return;
  container.innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center; padding:48px 20px; gap:16px;">
      <div style="width:36px;height:36px;border:3px solid var(--color-border-input);border-top-color:var(--color-primary-green);border-radius:50%;animation:spin-co 0.8s linear infinite;" aria-hidden="true"></div>
      <p class="text-muted">Cargando información de tu empresa…</p>
    </div>
    <style>@keyframes spin-co { to { transform: rotate(360deg); } }</style>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// INICIALIZACIÓN
// ─────────────────────────────────────────────────────────────────────────────

async function init() {
  // 1. Auth guard
  if (!TokenManager.isAuthenticated()) {
    TokenManager.logout();
    return;
  }

  const user = TokenManager.getUser();
  if (!user?.id) {
    TokenManager.logout();
    return;
  }

  // 2. Detectar si viene de un registro recién completado
  const justCreated = sessionStorage.getItem("company_just_created");
  if (justCreated) {
    sessionStorage.removeItem("company_just_created");
    sessionStorage.removeItem("company_id");
    notify.success("¡Tu empresa fue registrada exitosamente! Bienvenido a tu panel.");
  }

  // 3. Cargar empresa del usuario
  renderLoading();

  try {
    const company = await companyService.getByUserId(user.id);

    if (company) {
      // 3a. Si la empresa existe pero el token aún dice "Cliente",
      //     solicitar tokens frescos al backend (fallback de rol).
      if (user.role !== ROLES.COMPANY) {
        try {
          const upgraded = await companyService.upgradeRole();
          if (upgraded?.data?.accessToken) {
            TokenManager.saveToken(upgraded.data);
            console.info(
              "[HomeCompany] Token actualizado al rol:",
              upgraded.data.role_name,
            );
          }
        } catch (upgradeErr) {
          // No crítico: la sesión sigue siendo válida con el token anterior.
          // La empresa ya fue verificada vía API, así que permitimos el acceso.
          console.warn(
            "[HomeCompany] No se pudo actualizar el rol del token:",
            upgradeErr.message,
          );
        }
      }

      renderCompanyCard(company);
    } else {
      renderNoCompany();
    }
  } catch (err) {
    console.error("[HomeCompany] Error al cargar empresa:", err);
    const container = document.getElementById("companyContent");
    if (container) {
      container.innerHTML = `
        <div class="empty-state-billboard">
          <p class="text-muted">No se pudo cargar la información de la empresa. Intenta recargar la página.</p>
          <button onclick="location.reload()" class="btn btn-green-solid" style="margin-top:16px;">Reintentar</button>
        </div>
      `;
    }
  }
}

document.addEventListener("DOMContentLoaded", init);
