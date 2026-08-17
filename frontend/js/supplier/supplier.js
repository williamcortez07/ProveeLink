/**
 * @file supplier.js
 * @description Módulo de la vista de Información Específica de Proveedor (/pages/supplier/supplier.html).
 *
 * Responsabilidades:
 *  1. Obtener el ID del proveedor desde la URL (?id=UUID).
 *  2. Consultar la información del perfil del proveedor vía homeApi.getSupplierProfile().
 *  3. Consultar opcionalmente el catálogo de productos vía homeApi.getProductsBySupplier().
 *  4. Renderizar la tarjeta principal del proveedor, su descripción de servicios y su catálogo.
 */

import { homeApi } from "../services/api.js";
import { Router } from "../services/routes.js";

/**
 * Escapa caracteres HTML para evitar vulnerabilidades XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Genera una string de estrellas según el rating (0-5).
 * @param {number|string} rating
 * @returns {string}
 */
function buildStars(rating) {
  const rounded = Math.round(parseFloat(rating) || 0);
  return "★".repeat(Math.min(rounded, 5)) + "☆".repeat(Math.max(0, 5 - rounded));
}

/**
 * Renderiza el esqueleto de carga para el perfil del proveedor.
 * @param {HTMLElement} container
 */
function showProfileSkeleton(container) {
  container.innerHTML = `
    <div style="background:var(--color-bg);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:24px;margin-bottom:24px;">
      <div style="display:flex;gap:20px;align-items:center;margin-bottom:16px;">
        <div class="skeleton-circle" style="width:72px;height:72px;flex-shrink:0;"></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:10px;">
          <div class="skeleton-line" style="width:50%;height:24px;"></div>
          <div class="skeleton-line" style="width:30%;height:14px;"></div>
          <div class="skeleton-line" style="width:40%;height:14px;"></div>
        </div>
      </div>
      <div class="skeleton-line" style="width:100%;height:60px;border-radius:var(--radius-sm);"></div>
    </div>
  `;
}

/**
 * Carga y muestra los detalles completos del proveedor.
 */
async function loadSupplierProfile() {
  const container = document.getElementById("supplierProfileContainer");
  if (!container) return;

  const urlParams = new URLSearchParams(window.location.search);
  const supplierId = urlParams.get("id");

  if (!supplierId) {
    container.innerHTML = `
      <div class="empty-state" style="text-align:center;padding:40px 16px;background:var(--color-bg);border:1px solid var(--color-border);border-radius:var(--radius-md);">
        <h2 style="margin:0 0 8px;color:var(--color-ink);">Proveedor no encontrado</h2>
        <p style="margin:0 0 16px;color:var(--color-ink-soft);">No se especificó un ID de proveedor en la solicitud.</p>
        <a href="../home.html" class="btn btn-outline" style="display:inline-flex;">Volver al inicio</a>
      </div>`;
    return;
  }

  showProfileSkeleton(container);

  try {
    const res = await homeApi.getSupplierProfile(supplierId);
    const supplier = res?.data;

    if (!supplier) {
      container.innerHTML = `
        <div class="empty-state" style="text-align:center;padding:40px 16px;background:var(--color-bg);border:1px solid var(--color-border);border-radius:var(--radius-md);">
          <h2 style="margin:0 0 8px;color:var(--color-ink);">Proveedor no disponible</h2>
          <p style="margin:0 0 16px;color:var(--color-ink-soft);">El proveedor solicitado no existe o no se encuentra activo.</p>
          <a href="javascript:history.back()" class="btn btn-outline" style="display:inline-flex;">Volver atrás</a>
        </div>`;
      return;
    }

    document.title = `${supplier.company_name ?? "Proveedor"} · ProveeLink`;

    const rating = parseFloat(supplier.average_rating) || 0;
    const stars = buildStars(rating);
    const ratingDisplay = rating > 0 ? `${rating.toFixed(1)} / 5.0` : "Sin calificaciones aún";

    const coverageMap = {
      local: "Cobertura Local",
      regional: "Cobertura Regional",
      national: "Cobertura Nacional",
    };
    const coverage = coverageMap[supplier.geographic_coverage] ?? supplier.geographic_coverage ?? "";

    // Intentar cargar productos del proveedor
    let productsListHtml = "";
    try {
      const prodRes = await homeApi.getProductsBySupplier(supplierId);
      const products = prodRes?.data ?? [];
      if (products.length > 0) {
        productsListHtml = `
          <div style="margin-top: 32px;">
            <div class="section-header" style="margin-bottom: 16px;">
              <h2 class="section-title" style="font-size: 1.2rem;">
                <span class="dot"></span>
                Catálogo de Productos (${products.length})
              </h2>
            </div>
            <div class="providers-grid" style="grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px;">
              ${products.map((p) => `
                <article class="provider-card" style="flex-direction: column; align-items: flex-start; gap: 10px; height: 100%;">
                  <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                    <span style="font-size:0.75rem; font-weight:600; text-transform:uppercase; color:var(--color-primary-dark); background:var(--color-primary-light); padding:2px 8px; border-radius:var(--radius-pill);">
                      ${escapeHtml(p.category_name ?? "Producto")}
                    </span>
                    <span style="font-size:0.85rem; font-weight:700; color:var(--color-primary-dark);">
                      $${parseFloat(p.price || 0).toLocaleString("es-CR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <h4 style="margin:4px 0 0; font-family:var(--font-display); font-size:1.05rem; color:var(--color-ink);">
                    ${escapeHtml(p.name)}
                  </h4>
                  ${p.description ? `<p style="font-size:0.85rem; color:var(--color-ink-soft); margin:0; line-height:1.4;">${escapeHtml(p.description)}</p>` : ""}
                  ${p.stock !== undefined ? `<p style="font-size:0.78rem; color:var(--color-ink-soft); margin-top:auto;">Stock: <b>${p.stock}</b> unidades</p>` : ""}
                </article>
              `).join("")}
            </div>
          </div>
        `;
      }
    } catch (prodErr) {
      console.warn("[supplier.js] No se pudieron obtener productos:", prodErr);
    }

    container.innerHTML = `
      <!-- Header del Proveedor -->
      <article class="provider-card" style="flex-direction: column; align-items: flex-start; gap: 20px; padding: 28px; background: var(--color-bg); border-radius: var(--radius-md); box-shadow: var(--shadow-md);">
        <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 16px; width: 100%;">
          <div class="provider-logo" style="width: 72px; height: 72px; border-radius: var(--radius-md);">
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none">
              <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/>
              <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/>
              <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/>
              <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/>
            </svg>
          </div>
          <div style="flex: 1; min-width: 220px;">
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <h1 class="provider-name" style="font-size: 1.6rem; margin: 0;">
                ${escapeHtml(supplier.company_name ?? "Proveedor")}
              </h1>
              <span style="font-size: 0.78rem; font-weight: 700; color: #166534; background: #dcfce7; padding: 3px 10px; border-radius: var(--radius-pill);">
                ${escapeHtml(supplier.status ?? "activo").toUpperCase()}
              </span>
            </div>
            <p class="provider-category" style="font-size: 0.95rem; margin: 4px 0 8px;">
              ${escapeHtml(supplier.supplier_type ?? "Proveedor Registrado")}
            </p>
            <div class="provider-rating" style="gap: 8px;">
              <span class="stars" style="font-size: 1rem;">${stars}</span>
              <span class="rating-value" style="font-weight: 600;">${ratingDisplay}</span>
            </div>
          </div>
        </div>

        <hr style="width: 100%; border: 0; border-top: 1px solid var(--color-border); margin: 0;" />

        <!-- Detalles Operativos -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; width: 100%;">
          ${coverage ? `
          <div style="display: flex; align-items: center; gap: 8px; color: var(--color-ink-soft); font-size: 0.9rem;">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M12 21s-7-4.6-7-11a7 7 0 1 1 14 0c0 6.4-7 11-7 11Z"/>
              <circle cx="12" cy="10" r="2.4"/>
            </svg>
            <span><b>Alcance:</b> ${escapeHtml(coverage)}</span>
          </div>` : ""}

          ${supplier.operating_hours ? `
          <div style="display: flex; align-items: center; gap: 8px; color: var(--color-ink-soft); font-size: 0.9rem;">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="12" r="9"/>
              <path d="M12 7v5l3 3"/>
            </svg>
            <span><b>Horario:</b> ${escapeHtml(supplier.operating_hours)}</span>
          </div>` : ""}

          ${supplier.phone ? `
          <div style="display: flex; align-items: center; gap: 8px; color: var(--color-ink-soft); font-size: 0.9rem;">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            <span><b>Teléfono:</b> ${escapeHtml(supplier.phone)}</span>
          </div>` : ""}

          ${supplier.email ? `
          <div style="display: flex; align-items: center; gap: 8px; color: var(--color-ink-soft); font-size: 0.9rem;">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="m22 7-10 7L2 7"/>
            </svg>
            <span><b>Correo:</b> ${escapeHtml(supplier.email)}</span>
          </div>` : ""}
        </div>

        ${supplier.service_description ? `
        <div style="width: 100%; margin-top: 4px;">
          <h3 style="font-family: var(--font-display); font-size: 1.05rem; margin: 0 0 8px; color: var(--color-ink);">
            Servicios Ofrecidos
          </h3>
          <p style="font-size: 0.93rem; line-height: 1.6; color: var(--color-ink-soft); margin: 0; white-space: pre-line;">
            ${escapeHtml(supplier.service_description)}
          </p>
        </div>` : ""}
      </article>

      ${productsListHtml}
    `;
  } catch (err) {
    console.error("[supplier.js] Error al cargar perfil del proveedor:", err);
    container.innerHTML = `
      <div class="empty-state" style="text-align:center;padding:32px 16px;">
        <p>Ocurrió un error al cargar el perfil del proveedor.</p>
        <button class="retry-btn" id="retryBtn">Reintentar</button>
      </div>`;
    document.getElementById("retryBtn")?.addEventListener("click", loadSupplierProfile);
  }
}

function init() {
  Router.init();
  loadSupplierProfile();
}

document.addEventListener("DOMContentLoaded", init);
