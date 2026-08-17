/**
 * @file home.js
 * @description Módulo principal de la vista Home para clientes.
 *
 * Responsabilidades:
 *  1. Cargar categorías activas desde GET /api/v1/categories
 *  2. Cargar proveedores activos desde GET /api/v1/suppliers
 *  3. Manejar la búsqueda de proveedores con GET /api/v1/suppliers/search
 *  4. Renderizar estados: carga (skeleton), datos, vacío y error
 * --8/8/26 inicio
 */

import { homeApi, TokenManager } from "./services/api.js";

// ─────────────────────────────────────────────────────────────────────────────
// ÍCONOS SVG por defecto para categorías (fallback cuando icon_url está vacío)
// Se mapean por nombre normalizado de la categoría.
// estos íconos son genericos para categorias genericas o mas usadas, por lo general el ícono viene de
// la url
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORY_ICONS = {
  construcción: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M14.7 6.3 3 18l3 3L17.7 9.3M14.7 6.3 18 3l3 3-3.3 3.3M14.7 6.3l3.3 3.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  tecnología: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none"><rect x="3" y="4" width="18" height="12" rx="1.5" stroke="currentColor" stroke-width="1.8"/><path d="M8 20h8M12 16v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  belleza: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M6 4c4 0 4 3 6 3s2-3 6-3M4 12c0-2 2-3 4-2 3 1 6 1 8 0 2-1 4 0 4 2 0 5-4 9-8 9s-8-4-8-9Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  transporte: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M3 16V9a1 1 0 0 1 1-1h9v8M13 11h4l3 3v2h-2" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="7" cy="17" r="1.6" stroke="currentColor" stroke-width="1.8"/><circle cx="17" cy="17" r="1.6" stroke="currentColor" stroke-width="1.8"/></svg>`,
  salud: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M12 21s-7-4.6-9.3-9A5.4 5.4 0 0 1 12 6a5.4 5.4 0 0 1 9.3 6c-2.3 4.4-9.3 9-9.3 9Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  alimentación: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M5 3v18M5 3h11l-2 4 2 4H5" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  papelería: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="m17 3 4 4-11 11H6v-4L17 3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  hogar: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M4 11 12 4l8 7M6 10v9a1 1 0 0 0 1 1h4v-5h2v5h4a1 1 0 0 0 1-1v-9" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  default: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/></svg>`,
};

/**
 * Devuelve el SVG de ícono correspondiente al nombre de una categoría.
 * @param {string} name
 * @returns {string} SVG string
 */
function getCategoryIcon(name = "") {
  const key = name.toLowerCase().trim();
  return CATEGORY_ICONS[key] ?? CATEGORY_ICONS.default;
}

/**
 * Genera las estrellas visuales según el rating (0-5).
 * @param {number} rating
 * @returns {string} cadena de estrellas ★/☆
 */
function buildStars(rating) {
  const rounded = Math.round(parseFloat(rating) || 0);
  return "★".repeat(Math.min(rounded, 5)) + "☆".repeat(Math.max(0, 5 - rounded));
}


/**
 * Inserta N tarjetas skeleton en el contenedor dado.
 * @param {HTMLElement} container
 * @param {number} count
 * @param {'category'|'provider'} type
 */
function showSkeletons(container, count, type) {
  container.innerHTML = Array.from({ length: count }, () => {
    if (type === "category") {
      return `<div class="category-card skeleton-card" aria-hidden="true">
        <span class="category-icon skeleton-circle"></span>
        <span class="skeleton-line" style="width:60%;height:10px;border-radius:4px;"></span>
      </div>`;
    }
    return `<article class="provider-card skeleton-card" aria-hidden="true">
      <div class="provider-logo skeleton-circle" style="width:56px;height:56px;"></div>
      <div class="provider-body" style="gap:8px;display:flex;flex-direction:column;">
        <div class="skeleton-line" style="width:70%;height:14px;border-radius:4px;"></div>
        <div class="skeleton-line" style="width:50%;height:10px;border-radius:4px;"></div>
        <div class="skeleton-line" style="width:40%;height:10px;border-radius:4px;"></div>
      </div>
    </article>`;
  }).join("");
}

/**
 * Construye el elemento DOM de una tarjeta de categoría.
 * @param {{ id: string, name: string, icon_url: string|null }} cat
 * @returns {HTMLElement}
 */
function createCategoryCard(cat) {
  const a = document.createElement("a");
  a.className = "category-card";
  a.href = `../pages/categoryInfo.html?id=${encodeURIComponent(cat.id)}`;
  a.setAttribute("title", cat.name);

  const iconSpan = document.createElement("span");
  iconSpan.className = "category-icon";

  if (cat.icon_url) {
    const img = document.createElement("img");
    img.alt = cat.name;
    img.src = cat.icon_url;
    img.loading = "lazy";
    img.width = 22;
    img.height = 22;
    img.style.objectFit = "contain";
    img.addEventListener("error", () => {
      img.remove();
      iconSpan.innerHTML = getCategoryIcon(cat.name);
    });
    iconSpan.appendChild(img);
  } else {
    iconSpan.innerHTML = getCategoryIcon(cat.name);
  }

  const label = document.createElement("span");
  label.className = "category-label";
  label.textContent = cat.name;

  a.appendChild(iconSpan);
  a.appendChild(label);
  return a;
}

async function loadCategories() {
  const container = document.getElementById("categoriesGrid");
  const counter = document.getElementById("categoriesCount");
  if (!container) return;

  showSkeletons(container, 8, "category");

  try {
    const res = await homeApi.getCategories();
    const items = (res?.data ?? []).filter(
      (c) => c.status === "active" && !c.parent_id
    );

    container.innerHTML = "";

    if (!items.length) {
      container.innerHTML = `
        <p class="empty-state" style="grid-column:1/-1;text-align:center;color:var(--color-ink-soft);padding:24px 0;">
          No hay categorías disponibles.
        </p>`;
      return;
    }

    if (counter) counter.textContent = `(${items.length})`;

    items.forEach((cat) => {
      container.appendChild(createCategoryCard(cat));
    });
  } catch (err) {
    console.error("[home.js] Error cargando categorías:", err);
    container.innerHTML = `
      <p class="empty-state" style="grid-column:1/-1;text-align:center;color:var(--color-ink-soft);padding:24px 0;">
        No se pudieron cargar las categorías. <button class="retry-btn" id="retryCategoriesBtn">Reintentar</button>
      </p>`;
    document
      .getElementById("retryCategoriesBtn")
      ?.addEventListener("click", loadCategories);
  }
}


/**
 * Construye el elemento DOM de una tarjeta de proveedor.
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
      <p class="provider-category">${escapeHtml(supplier.supplier_type ?? "")}</p>
      <div class="provider-rating">
        <span class="stars" aria-label="${rating} de 5 estrellas">${stars}</span>
        <span class="rating-value">${ratingDisplay}</span>
      </div>
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
 * Escapa caracteres HTML para evitar XSS.
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
 * Carga y renderiza los proveedores activos en el grid.
 * Carga los primeros 6 proveedores ordenados por rating.
 */
async function loadSuppliers() {
  const container = document.getElementById("providersGrid");
  const counter = document.getElementById("suppliersCount");
  if (!container) return;

  showSkeletons(container, 3, "provider");

  try {
    // Pedimos los primeros 6, ordenados por fecha de registro desc
    const res = await homeApi.getSuppliers({ pageSize: 6, sortBy: "created_at", sortOrder: "desc" });
    const items = (res?.data ?? []).filter((s) => s.status === "active");

    container.innerHTML = "";

    if (!items.length) {
      container.innerHTML = `
        <p class="empty-state" style="grid-column:1/-1;text-align:center;color:var(--color-ink-soft);padding:24px 0;">
          No hay proveedores registrados aún.
        </p>`;
      return;
    }

    if (counter) counter.textContent = `(${res?.pagination?.totalItems ?? items.length} en total)`;

    items.forEach((supplier) => {
      container.appendChild(createProviderCard(supplier));
    });
  } catch (err) {
    console.error("[home.js] Error cargando proveedores:", err);
    container.innerHTML = `
      <p class="empty-state" style="grid-column:1/-1;text-align:center;color:var(--color-ink-soft);padding:24px 0;">
        No se pudieron cargar los proveedores. <button class="retry-btn" id="retrySuppliersBtn">Reintentar</button>
      </p>`;
    document
      .getElementById("retrySuppliersBtn")
      ?.addEventListener("click", loadSuppliers);
  }
}

/**
 * Realiza la búsqueda de proveedores y actualiza el grid de proveedores.
 * @param {string} query
 */
async function searchAndRender(query) {
  const container = document.getElementById("providersGrid");
  const sectionTitle = document.getElementById("suppliersSectionTitle");
  if (!container) return;

  if (!query.trim()) {
    // Si la búsqueda está vacía, recarga los proveedores destacados
    if (sectionTitle) sectionTitle.textContent = "Proveedores destacados";
    return loadSuppliers();
  }

  showSkeletons(container, 3, "provider");
  if (sectionTitle) sectionTitle.textContent = `Resultados para "${escapeHtml(query)}"`;

  try {
    const res = await homeApi.searchSuppliers(query);
    const items = res?.data ?? [];

    container.innerHTML = "";

    if (!items.length) {
      container.innerHTML = `
        <p class="empty-state" style="grid-column:1/-1;text-align:center;color:var(--color-ink-soft);padding:24px 0;">
          No se encontraron proveedores para "<strong>${escapeHtml(query)}</strong>".
        </p>`;
      return;
    }

    items.forEach((supplier) => {
      container.appendChild(createProviderCard(supplier));
    });
  } catch (err) {
    console.error("[home.js] Error en búsqueda:", err);
    container.innerHTML = `
      <p class="empty-state" style="grid-column:1/-1;text-align:center;color:var(--color-ink-soft);padding:24px 0;">
        Error al buscar. Intente de nuevo.
      </p>`;
  }
}

function initSearch() {
  const form = document.getElementById("searchForm");
  const input = document.getElementById("searchInput");
  if (!form || !input) return;

  let debounceTimer;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    searchAndRender(input.value);
  });

  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (input.value.length === 0 || input.value.length >= 3) {
        searchAndRender(input.value);
      }
    }, 500);
  });
}

async function init() {
  if (!TokenManager.isAuthenticated()) {
    TokenManager.logout();
    return;
  }
  await Promise.allSettled([loadCategories(), loadSuppliers()]);
  initSearch();
}

document.addEventListener("DOMContentLoaded", init);
