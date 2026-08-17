/**
 * @file categoryInfo.js
 * @description Módulo de la vista de Proveedores por Categoría (/pages/categoryInfo.html).
 *
 * Responsabilidades:
 *  1. Obtener el ID de la categoría desde los parámetros de la URL (?id=UUID).
 *  2. Consultar detalles de la categoría y la lista de proveedores asociados vía homeApi.
 *  3. Renderizar estados de carga (skeleton), datos dinámicos, resultado vacío y errores.
 *  4. Permitir navegar hacia el perfil del proveedor seleccionado.
 */

import { homeApi, TokenManager } from "./services/api.js";
import { Router } from "./services/routes.js";

/**
 * Escapa caracteres HTML para prevenir inyecciones XSS.
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
 * Genera una representación de estrellas según la calificación (0.00 - 5.00).
 * @param {number|string} rating
 * @returns {string}
 */
function buildStars(rating) {
  const rounded = Math.round(parseFloat(rating) || 0);
  return "★".repeat(Math.min(rounded, 5)) + "☆".repeat(Math.max(0, 5 - rounded));
}

/**
 * Muestra las tarjetas esqueleto durante la carga.
 * @param {HTMLElement} container
 * @param {number} count
 */
function showSkeletons(container, count) {
  container.innerHTML = Array.from({ length: count }, () => `
    <article class="provider-card skeleton-card" aria-hidden="true">
      <div class="provider-logo skeleton-circle" style="width:56px;height:56px;"></div>
      <div class="provider-body" style="gap:8px;display:flex;flex-direction:column;width:100%;">
        <div class="skeleton-line" style="width:70%;height:16px;"></div>
        <div class="skeleton-line" style="width:40%;height:12px;"></div>
        <div class="skeleton-line" style="width:50%;height:12px;"></div>
        <div class="skeleton-line" style="width:90%;height:10px;"></div>
      </div>
    </article>
  `).join("");
}

/**
 * Crea el elemento DOM de la tarjeta de un proveedor.
 * @param {object} supplier
 * @returns {HTMLElement}
 */
function createProviderCard(supplier) {
  const article = document.createElement("article");
  article.className = "provider-card";

  const rating = parseFloat(supplier.average_rating) || 0;
  const stars = buildStars(rating);
  const ratingDisplay = rating > 0 ? `${rating.toFixed(1)}` : "Sin calificación";

  const coverageMap = {
    local: "Local",
    regional: "Regional",
    national: "Nacional",
  };
  const coverage = coverageMap[supplier.geographic_coverage] ?? supplier.geographic_coverage ?? "";

  article.innerHTML = `
    <div class="provider-logo" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
        <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/>
      </svg>
    </div>
    <div class="provider-body">
      <h3 class="provider-name">${escapeHtml(supplier.company_name ?? "Proveedor")}</h3>
      <p class="provider-category">${escapeHtml(supplier.supplier_type ?? "Proveedor Registrado")}</p>
      
      <div class="provider-rating">
        <span class="stars" aria-label="${rating} de 5 estrellas">${stars}</span>
        <span class="rating-value">${ratingDisplay}</span>
      </div>

      ${supplier.service_description ? `
      <p class="provider-description" style="font-size:0.83rem;color:var(--color-ink-soft);margin:4px 0 8px;line-height:1.4;">
        ${escapeHtml(supplier.service_description)}
      </p>` : ""}

      ${coverage ? `
      <p class="provider-location">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
          <path d="M12 21s-7-4.6-7-11a7 7 0 1 1 14 0c0 6.4-7 11-7 11Z" stroke="currentColor" stroke-width="1.6"/>
          <circle cx="12" cy="10" r="2.4" stroke="currentColor" stroke-width="1.6"/>
        </svg>
        Cobertura ${coverage}
      </p>` : ""}
    </div>
    <a href="../pages/supplier/supplier.html?id=${encodeURIComponent(supplier.id)}" class="btn btn-outline provider-cta">
      Ver perfil
    </a>
  `;

  return article;
}

/**
 * Carga la información de la categoría y los proveedores correspondientes.
 */
async function loadCategoryProviders() {
  const container = document.getElementById("providersGrid");
  const titleEl = document.getElementById("categoryTitle");
  const subtitleEl = document.getElementById("categorySubtitle");

  const urlParams = new URLSearchParams(window.location.search);
  const categoryId = urlParams.get("id");

  if (!categoryId) {
    if (titleEl) titleEl.innerHTML = `<span class="dot"></span><span>Categoría no especificada</span>`;
    if (subtitleEl) subtitleEl.textContent = "Por favor selecciona una categoría válida.";
    if (container) {
      container.innerHTML = `
        <p class="empty-state" style="grid-column:1/-1;text-align:center;color:var(--color-ink-soft);padding:32px 0;">
          No se especificó ninguna categoría. <a href="../pages/category.html" class="link-more">Ver todas las categorías</a>
        </p>`;
    }
    return;
  }

  showSkeletons(container, 4);

  try {
    // 1. Obtener la información de la categoría seleccionada
    let categoryName = "Categoría";
    try {
      const catRes = await homeApi.getCategoryById(categoryId);
      if (catRes?.data?.name) {
        categoryName = catRes.data.name;
      }
    } catch (catErr) {
      console.warn("[categoryInfo.js] No se pudo obtener el nombre exacto de la categoría:", catErr);
    }

    if (titleEl) {
      document.title = `${categoryName} · ProveeLink`;
      titleEl.innerHTML = `
        <span class="dot"></span>
        <span>Proveedores en <b>${escapeHtml(categoryName)}</b></span>
      `;
    }

    // 2. Obtener los proveedores pertenecientes a esta categoría
    const res = await homeApi.getSuppliers({ category_id: categoryId, pageSize: 50 });
    const suppliers = (res?.data ?? []).filter((s) => s.status === "active");

    container.innerHTML = "";

    if (subtitleEl) {
      subtitleEl.textContent = suppliers.length === 1
        ? "1 proveedor disponible en esta categoría."
        : `${suppliers.length} proveedores disponibles en esta categoría.`;
    }

    if (!suppliers.length) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;text-align:center;color:var(--color-ink-soft);padding:40px 16px;background:var(--color-bg);border:1px dashed var(--color-border);border-radius:var(--radius-md);">
          <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:12px;color:var(--color-ink-soft);">
            <circle cx="12" cy="12" r="10"/>
            <path d="M8 12h8"/>
          </svg>
          <h3 style="margin:0 0 8px;color:var(--color-ink);font-size:1.1rem;">Sin proveedores en esta categoría</h3>
          <p style="margin:0 0 16px;font-size:0.9rem;">No hay proveedores registrados ofreciendo productos en esta categoría actualmente.</p>
          <a href="../pages/category.html" class="btn btn-outline" style="display:inline-flex;">Explorar otras categorías</a>
        </div>`;
      return;
    }

    suppliers.forEach((supplier) => {
      container.appendChild(createProviderCard(supplier));
    });
  } catch (err) {
    console.error("[categoryInfo.js] Error al cargar proveedores por categoría:", err);
    if (subtitleEl) subtitleEl.textContent = "Ocurrió un problema al consultar la información.";
    if (container) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;text-align:center;color:var(--color-ink-soft);padding:32px 16px;">
          <p>No se pudieron cargar los proveedores para esta categoría.</p>
          <button class="retry-btn" id="retryBtn">Reintentar</button>
        </div>`;
      document.getElementById("retryBtn")?.addEventListener("click", loadCategoryProviders);
    }
  }
}

function init() {
  Router.init();
  loadCategoryProviders();
}

document.addEventListener("DOMContentLoaded", init);
