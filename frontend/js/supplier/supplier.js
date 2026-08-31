/**
 * @file supplier.js
 * @description Módulo de la vista de Perfil de Proveedor (/pages/supplier/supplier.html).
 *
 * Responsabilidades:
 *  1. Obtener el ID del proveedor desde la URL (?id=UUID).
 *  2. Cargar el perfil del proveedor vía homeApi.getSupplierProfile().
 *  3. Cargar el catálogo de productos vía homeApi.getProductsBySupplier().
 *  4. Cargar y mostrar estadísticas de Rating vía ratingApi.getRatingStats().
 *  5. Detectar si el usuario ya calificó y mostrar su rating previo.
 *  6. Permitir crear/actualizar un rating (upsert) vía ratingApi.upsertRating().
 *  7. Cargar comentarios visibles vía commentApi.getComments().
 *  8. Permitir crear, editar y eliminar comentarios propios.
 *
 * Separación de responsabilidades:
 *  - API:       commentApi, ratingApi, homeApi (api.js) — nunca fetch() directo.
 *  - UI:        funciones render* y build* — solo manipulan DOM.
 *  - Eventos:   funciones init* — adjuntan listeners.
 *  - Errores:   notify.error() para el usuario, console.error() para desarrollo.
 */

import { homeApi, commentApi, ratingApi, TokenManager } from "../services/api.js";
import { Router } from "../services/routes.js";
import { notify } from "../services/notificationService.js";

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO LOCAL DEL MÓDULO
// ─────────────────────────────────────────────────────────────────────────────

/** ID del proveedor extraído de la URL. */
let supplierId = null;

/** Usuario autenticado (desde JWT). */
let currentUser = null;

/** Rating del usuario actual para este proveedor (null si no ha calificado). */
let userExistingRating = null;

/** Estado de operación pendiente para evitar peticiones duplicadas. */
let ratingPending = false;
let commentPending = false;

/** Página actual de comentarios para paginación. */
let commentsPage = 1;
const COMMENTS_PAGE_SIZE = 10;

// ─────────────────────────────────────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Escapa caracteres HTML para prevenir XSS.
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
 * Formatea una fecha ISO a una cadena legible en español.
 * @param {string} isoString
 * @returns {string}
 */
function formatDate(isoString) {
  if (!isoString) return "";
  try {
    return new Date(isoString).toLocaleDateString("es-CR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return isoString;
  }
}

/**
 * Retorna las iniciales de un nombre completo para el avatar.
 * @param {string} firstName
 * @param {string} lastName
 * @returns {string}
 */
function getInitials(firstName, lastName) {
  const f = (firstName ?? "").trim().charAt(0).toUpperCase();
  const l = (lastName ?? "").trim().charAt(0).toUpperCase();
  return f + l || "?";
}

/**
 * Genera HTML de estrellas rellenas/vacías para visualización.
 * @param {number} score - Valor entre 0 y 5.
 * @param {boolean} [large=false] - Tamaño grande o pequeño.
 * @returns {string} SVG HTML
 */
function buildStarsSvg(score, large = false) {
  const size = large ? 24 : 16;
  const filled = Math.round(score);
  return Array.from({ length: 5 }, (_, i) => {
    const isFilled = i < filled;
    return `<svg class="star-icon ${isFilled ? "filled" : ""}" width="${size}" height="${size}"
      viewBox="0 0 24 24" fill="${isFilled ? "currentColor" : "none"}"
      stroke="currentColor" stroke-width="1.8">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>`;
  }).join("");
}

/**
 * Genera las estrellas de texto (★☆) para compatibilidad con la vista existente.
 * @param {number} rating
 * @returns {string}
 */
function buildStars(rating) {
  const rounded = Math.round(parseFloat(rating) || 0);
  return "★".repeat(Math.min(rounded, 5)) + "☆".repeat(Math.max(0, 5 - rounded));
}

/**
 * Mapas de cobertura geográfica a texto legible.
 */
const COVERAGE_MAP = {
  local: "Cobertura Local",
  regional: "Cobertura Regional",
  national: "Cobertura Nacional",
};

// ─────────────────────────────────────────────────────────────────────────────
// SKELETONS DE CARGA
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Muestra esqueleto de carga para el perfil del proveedor.
 * @param {HTMLElement} container
 */
function showProfileSkeleton(container) {
  container.innerHTML = `
    <div style="background:var(--color-bg-card);border:1px solid var(--color-border-input);border-radius:var(--radius-large);padding:24px;margin-bottom:24px;">
      <div style="display:flex;gap:20px;align-items:center;margin-bottom:16px;">
        <div class="skeleton-circle" style="width:72px;height:72px;flex-shrink:0;"></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:10px;">
          <div class="skeleton-line" style="width:50%;height:24px;"></div>
          <div class="skeleton-line" style="width:30%;height:14px;"></div>
          <div class="skeleton-line" style="width:40%;height:14px;"></div>
        </div>
      </div>
      <div class="skeleton-line" style="width:100%;height:60px;border-radius:var(--radius-medium);"></div>
    </div>
    <div style="background:var(--color-bg-card);border:1px solid var(--color-border-input);border-radius:var(--radius-large);padding:24px;margin-bottom:24px;">
      <div class="skeleton-line" style="width:40%;height:18px;margin-bottom:16px;"></div>
      <div class="skeleton-line" style="width:100%;height:80px;border-radius:var(--radius-medium);"></div>
    </div>
  `;
}

/**
 * Muestra esqueletos de carga para la lista de comentarios.
 * @param {HTMLElement} container
 * @param {number} [count=3]
 */
function showCommentSkeletons(container, count = 3) {
  container.innerHTML = Array.from({ length: count }, () => `
    <div class="skeleton-comment-card">
      <div style="display:flex;gap:10px;margin-bottom:12px;">
        <div class="skeleton-circle" style="width:38px;height:38px;flex-shrink:0;"></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:6px;">
          <div class="skeleton-line" style="width:40%;height:14px;"></div>
          <div class="skeleton-line" style="width:25%;height:10px;"></div>
        </div>
      </div>
      <div class="skeleton-line" style="width:100%;height:50px;border-radius:var(--radius-medium);"></div>
    </div>
  `).join("");
}

/**
 * Formatea un número a precio con símbolo de moneda.
 * @param {number|string} val
 * @param {string} [currency="USD"]
 * @returns {string}
 */
function formatPrice(val, currency = "USD") {
  const num = parseFloat(val) || 0;
  const symbolMap = { USD: "$", HNL: "L", NIO: "C$", EUR: "€" };
  const symbol = symbolMap[currency] || `${currency} `;
  return `${symbol}${num.toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDERIZADO DEL PERFIL DEL PROVEEDOR
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Carga y renderiza el perfil del proveedor junto con sus productos, ratings y comentarios.
 */
async function loadSupplierProfile() {
  const container = document.getElementById("supplierProfileContainer");
  if (!container) return;

  if (!supplierId) {
    container.innerHTML = `
      <div class="empty-state-billboard">
        <h2 style="margin:0 0 8px;color:var(--color-ink);">Proveedor no encontrado</h2>
        <p style="margin:0 0 16px;color:var(--color-ink-soft);">No se especificó un ID de proveedor en la solicitud.</p>
        <a href="../home.html" class="btn btn-outline-blue">Volver al inicio</a>
      </div>`;
    return;
  }

  showProfileSkeleton(container);

  try {
    const res = await homeApi.getSupplierProfile(supplierId);
    const supplier = res?.data;

    if (!supplier) {
      container.innerHTML = `
        <div class="empty-state-billboard">
          <h2 style="margin:0 0 8px;">Proveedor no disponible</h2>
          <p style="margin:0 0 16px;color:var(--color-ink-soft);">El proveedor solicitado no existe o no está activo.</p>
          <a href="javascript:history.back()" class="btn btn-outline-blue">Volver</a>
        </div>`;
      return;
    }

    document.title = `${supplier.company_name ?? "Proveedor"} · ProveeLink`;

    // Intentar obtener la información de la Empresa (teléfono, email, dirección)
    let company = null;
    if (supplier.company_id) {
      try {
        const compRes = await homeApi.getCompanyById(supplier.company_id);
        company = compRes?.data ?? null;
      } catch (compErr) {
        console.warn("[supplier.js] No se pudo obtener la empresa asociada:", compErr);
      }
    }

    const phone = company?.phone || supplier.phone;
    const email = company?.email || supplier.email;

    // Normalización de WhatsApp
    const cleanPhone = phone ? String(phone).replace(/[^\d+]/g, "") : "";
    const waNumber = cleanPhone.startsWith("+") ? cleanPhone.slice(1) : cleanPhone;
    const waLink = waNumber ? `https://wa.me/${waNumber}` : null;

    const rating = parseFloat(supplier.average_rating) || 0;
    const stars = buildStars(rating);
    const ratingDisplay = rating > 0 ? `${rating.toFixed(1)} / 5.0` : "Sin calificaciones";
    const coverage = COVERAGE_MAP[supplier.geographic_coverage] ?? supplier.geographic_coverage ?? "";

    container.innerHTML = `
      <!-- Header / Perfil del proveedor -->
      <article style="background:var(--color-bg-card);border:1px solid var(--color-border-input);border-radius:var(--radius-large);padding:28px;margin-bottom:28px;box-shadow:var(--shadow-md);">
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:20px;width:100%;">
          <div style="width:72px;height:72px;border-radius:var(--radius-medium);background:var(--tint-blue);border:1px solid var(--color-border-input);display:flex;align-items:center;justify-content:center;color:var(--color-accent-blue);flex-shrink:0;">
            <svg viewBox="0 0 24 24" width="36" height="36" fill="none">
              <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/>
              <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/>
              <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/>
              <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/>
            </svg>
          </div>
          <div style="flex:1;min-width:240px;">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
              <h1 style="font-size:1.6rem;font-weight:800;margin:0;color:var(--color-text-main);">
                ${escapeHtml(supplier.company_name ?? "Proveedor")}
              </h1>
              <span style="font-size:0.75rem;font-weight:700;color:#166534;background:#dcfce7;padding:3px 10px;border-radius:var(--radius-pill);">
                ${escapeHtml(supplier.status ?? "activo").toUpperCase()}
              </span>
            </div>
            <p style="font-size:0.95rem;margin:4px 0 8px;color:var(--color-text-muted);">
              ${escapeHtml(supplier.supplier_type ?? "Proveedor Registrado")}
            </p>
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="color:#f59e0b;font-size:1rem;">${stars}</span>
              <span style="font-size:0.9rem;font-weight:600;color:var(--color-text-main);">${ratingDisplay}</span>
            </div>
          </div>

          ${waLink ? `
          <div class="supplier-header-actions" style="margin-left:auto;">
            <a href="${escapeHtml(waLink)}" target="_blank" rel="noopener noreferrer" class="btn-whatsapp-contact" style="padding:10px 18px;font-size:0.9rem;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              Contactar por WhatsApp
            </a>
          </div>` : ""}
        </div>

        <hr style="width:100%;border:0;border-top:1px solid var(--color-border-subtle);margin:20px 0;" />

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">
          ${coverage ? `
          <div style="display:flex;align-items:center;gap:8px;color:var(--color-text-muted);font-size:0.9rem;">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M12 21s-7-4.6-7-11a7 7 0 1 1 14 0c0 6.4-7 11-7 11Z"/>
              <circle cx="12" cy="10" r="2.4"/>
            </svg>
            <span><b>Alcance:</b> ${escapeHtml(coverage)}</span>
          </div>` : ""}
          ${supplier.operating_hours ? `
          <div style="display:flex;align-items:center;gap:8px;color:var(--color-text-muted);font-size:0.9rem;">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="12" r="9"/>
              <path d="M12 7v5l3 3"/>
            </svg>
            <span><b>Horario:</b> ${escapeHtml(supplier.operating_hours)}</span>
          </div>` : ""}
          ${phone ? `
          <div style="display:flex;align-items:center;gap:8px;color:var(--color-text-muted);font-size:0.9rem;">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            <span><b>Teléfono:</b> ${escapeHtml(phone)}</span>
          </div>` : ""}
          ${email ? `
          <div style="display:flex;align-items:center;gap:8px;color:var(--color-text-muted);font-size:0.9rem;">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="m22 7-10 7L2 7"/>
            </svg>
            <span><b>Correo:</b> ${escapeHtml(email)}</span>
          </div>` : ""}
        </div>

        ${supplier.service_description ? `
        <div style="margin-top:16px;">
          <h3 style="font-size:1rem;font-weight:700;margin:0 0 8px;color:var(--color-text-main);">Servicios Ofrecidos</h3>
          <p style="font-size:0.93rem;line-height:1.6;color:var(--color-text-muted);margin:0;white-space:pre-line;">
            ${escapeHtml(supplier.service_description)}
          </p>
        </div>` : ""}
      </article>

      <!-- SECCIÓN 1: Catálogo de Productos (Prioridad Principal) -->
      <div id="productsSection"></div>

      <!-- SECCIÓN 2: Calificaciones -->
      <div id="ratingSection"></div>

      <!-- SECCIÓN 3: Comentarios -->
      <div id="commentsSection"></div>
    `;

    // Cargar Catálogo, Ratings y Comentarios en paralelo
    await Promise.allSettled([
      loadProductsSection(supplier, phone),
      loadRatingSection(),
      loadCommentsSection(),
    ]);

  } catch (err) {
    console.error("[supplier.js] Error al cargar perfil:", err);
    const msg = err.status === 404
      ? "El proveedor solicitado no existe."
      : "Ocurrió un error al cargar el perfil del proveedor.";
    container.innerHTML = `
      <div class="empty-state-billboard" style="padding:40px 16px;">
        <p style="color:var(--color-text-muted);margin-bottom:16px;">${escapeHtml(msg)}</p>
        <button class="btn btn-light-subtle" id="retryProfileBtn">Reintentar</button>
      </div>`;
    document.getElementById("retryProfileBtn")?.addEventListener("click", loadSupplierProfile);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CATÁLOGO DE PRODUCTOS (VISTA PÚBLICA)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Carga y renderiza el catálogo de productos del proveedor.
 * @param {object} supplier
 * @param {string|null} phone - Teléfono de contacto
 */
async function loadProductsSection(supplier, phone) {
  const container = document.getElementById("productsSection");
  if (!container) return;

  container.innerHTML = `
    <div class="supplier-catalog-section">
      <div class="supplier-catalog-header">
        <h2 class="supplier-catalog-title">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
          </svg>
          Catálogo de Productos
        </h2>
      </div>
      <div class="product-pub-grid">
        ${Array.from({ length: 4 }, () => `<div class="skeleton-prod-card"><div class="skeleton-line skeleton-prod-img"></div><div class="skeleton-prod-body"><div class="skeleton-line" style="width:60%;height:14px;"></div><div class="skeleton-line" style="width:40%;height:10px;"></div></div></div>`).join("")}
      </div>
    </div>`;

  try {
    const prodRes = await homeApi.getProductsBySupplier(supplierId);
    const products = prodRes?.data ?? [];

    if (products.length === 0) {
      container.innerHTML = `
        <div class="supplier-catalog-section">
          <div class="supplier-catalog-header">
            <h2 class="supplier-catalog-title">Catálogo de Productos</h2>
          </div>
          <div style="background:var(--color-bg-card);border:1px dashed var(--color-border-input);border-radius:var(--radius-large);padding:40px 20px;text-align:center;color:var(--color-text-muted);">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:12px;opacity:0.6;">
              <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
            </svg>
            <h3 style="margin:0 0 6px;color:var(--color-text-main);font-size:1.1rem;">Este proveedor aún no tiene productos publicados</h3>
            <p style="margin:0;font-size:0.88rem;">Vuelve a consultar más tarde para explorar sus ofertas.</p>
          </div>
        </div>`;
      return;
    }

    const cardsHtml = products.map((p) => buildProductCardHtml(p)).join("");

    container.innerHTML = `
      <div class="supplier-catalog-section">
        <div class="supplier-catalog-header">
          <h2 class="supplier-catalog-title">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
            </svg>
            Catálogo de Productos
            <span class="supplier-catalog-count">${products.length}</span>
          </h2>
        </div>
        <div class="product-pub-grid">
          ${cardsHtml}
        </div>
      </div>`;

    // Eventos para abrir el modal de detalle
    container.querySelectorAll("[data-open-product-modal]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        openProductDetailModal(btn.dataset.openProductModal, supplier, phone);
      });
    });

    container.querySelectorAll(".product-pub-card").forEach((card) => {
      card.addEventListener("click", () => {
        openProductDetailModal(card.dataset.productId, supplier, phone);
      });
    });

  } catch (err) {
    console.error("[supplier.js] Error al cargar productos:", err);
    container.innerHTML = `
      <div class="supplier-catalog-section">
        <div style="background:var(--color-bg-card);border:1px solid var(--color-border-input);border-radius:var(--radius-large);padding:24px;text-align:center;color:var(--color-text-muted);">
          <p style="margin:0 0 12px;">No se pudieron cargar los productos de este proveedor.</p>
          <button class="btn btn-light-subtle" id="retryProductsBtn">Reintentar</button>
        </div>
      </div>`;
    document.getElementById("retryProductsBtn")?.addEventListener("click", () => loadProductsSection(supplier, phone));
  }
}

/**
 * Construye el HTML de la tarjeta de un producto público.
 * @param {object} p - Producto
 * @returns {string}
 */
function buildProductCardHtml(p) {
  const imgUrl = p.primary_image_url || p.image_url;
  const statusKey = (p.status ?? "activo").toLowerCase();
  const statusLabel = { activo: "Disponible", disponible: "Disponible", agotado: "Agotado", no_disponible: "No disponible", inactivo: "Inactivo" }[statusKey] ?? statusKey;

  const imageBlock = imgUrl ? `
    <img
      src="${escapeHtml(imgUrl)}"
      alt="${escapeHtml(p.name)}"
      class="product-pub-img"
      onerror="this.onerror=null; this.parentNode.innerHTML='<div class=\\'product-pub-placeholder\\'><svg width=\\'40\\' height=\\'40\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'1.5\\'><rect x=\\'3\\' y=\\'3\\' width=\\'18\\' height=\\'18\\' rx=\\'2\\'/><circle cx=\\'8.5\\' cy=\\'8.5\\' r=\\'1.5\\'/><polyline points=\\'21 15 16 10 5 21\\'/></svg><span>Imagen no disponible</span></div>';"
    />
  ` : `
    <div class="product-pub-placeholder">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
      <span>Sin imagen</span>
    </div>
  `;

  return `
    <article class="product-pub-card" data-product-id="${p.id}">
      <div class="product-pub-img-wrap">
        ${imageBlock}
        <span class="product-pub-badge product-pub-badge--${statusKey}">
          ${escapeHtml(statusLabel)}
        </span>
      </div>

      <div class="product-pub-body">
        <span class="product-pub-category">${escapeHtml(p.category_name ?? "Producto")}</span>
        <h3 class="product-pub-title">${escapeHtml(p.name)}</h3>
        ${p.description ? `<p class="product-pub-desc">${escapeHtml(p.description)}</p>` : ""}

        <div class="product-pub-meta">
          <div>
            <span class="product-pub-price">${formatPrice(p.price, p.currency)}</span>
            ${p.unit_of_measure ? `<span class="product-pub-unit">/ ${escapeHtml(p.unit_of_measure)}</span>` : ""}
          </div>
          ${p.stock !== undefined ? `<span class="product-pub-stock">Stock: <b>${p.stock}</b></span>` : ""}
        </div>
      </div>

      <div class="product-pub-footer">
        <button class="btn btn-green-solid product-pub-btn-detail" data-open-product-modal="${p.id}">
          Ver detalle del producto
        </button>
      </div>
    </article>`;
}

/**
 * Abre el modal con la vista detallada de un producto.
 * @param {string} productId
 * @param {object} supplier
 * @param {string|null} phone
 */
async function openProductDetailModal(productId, supplier, phone) {
  // Eliminar modal anterior si existe
  document.getElementById("productDetailModalOverlay")?.remove();

  // Overlay con loader mientras obtiene datos completos del producto
  const overlay = document.createElement("div");
  overlay.id = "productDetailModalOverlay";
  overlay.className = "product-modal-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");

  overlay.innerHTML = `
    <div class="product-detail-modal" style="padding:48px 24px;text-align:center;align-items:center;">
      <div class="spinner-inline" style="width:36px;height:36px;border-width:3px;border-top-color:var(--color-primary-green);margin-bottom:16px;"></div>
      <p style="color:var(--color-text-muted);margin:0;">Cargando detalle del producto...</p>
    </div>`;

  document.body.appendChild(overlay);

  try {
    const res = await homeApi.getProductById(productId);
    const product = res?.data ?? res;

    if (!product) {
      overlay.querySelector(".product-detail-modal").innerHTML = `
        <p style="color:var(--color-text-main);font-weight:700;margin-bottom:16px;">Producto no encontrado</p>
        <button class="btn btn-light-subtle" id="closeDetailModalBtn">Cerrar</button>`;
      document.getElementById("closeDetailModalBtn")?.addEventListener("click", () => overlay.remove());
      return;
    }

    renderProductDetailModalContent(overlay, product, supplier, phone);

  } catch (err) {
    console.error("[supplier.js] Error al cargar detalle del producto:", err);
    overlay.querySelector(".product-detail-modal").innerHTML = `
      <p style="color:var(--color-text-muted);margin-bottom:16px;">No se pudo cargar el detalle del producto.</p>
      <button class="btn btn-light-subtle" id="closeDetailModalBtn">Cerrar</button>`;
    document.getElementById("closeDetailModalBtn")?.addEventListener("click", () => overlay.remove());
  }
}

/**
 * Renderiza el contenido interno del modal de detalle de producto.
 * @param {HTMLElement} overlay
 * @param {object} product
 * @param {object} supplier
 * @param {string|null} phone
 */
function renderProductDetailModalContent(overlay, product, supplier, phone) {
  const images = Array.isArray(product.images) && product.images.length > 0
    ? product.images
    : (product.primary_image_url || product.image_url
      ? [{ id: "primary", image_url: product.primary_image_url || product.image_url }]
      : []);

  const activeImgUrl = images.length > 0 ? images[0].image_url : null;

  // Normalizar número de WhatsApp
  const cleanPhone = phone ? String(phone).replace(/[^\d+]/g, "") : "";
  const waNumber = cleanPhone.startsWith("+") ? cleanPhone.slice(1) : cleanPhone;
  const msg = `Hola, me interesa el producto "${product.name}" que vi en ProveeLink.`;
  const waLink = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}` : null;

  const mainImageHtml = activeImgUrl ? `
    <img id="detailMainImg" src="${escapeHtml(activeImgUrl)}" alt="${escapeHtml(product.name)}" />
  ` : `
    <div class="product-pub-placeholder">
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
      <span>Imagen no disponible</span>
    </div>
  `;

  const thumbsHtml = images.length > 1 ? `
    <div class="product-gallery-thumbs">
      ${images.map((img, i) => `
        <div class="product-gallery-thumb ${i === 0 ? "active" : ""}" data-thumb-src="${escapeHtml(img.image_url)}">
          <img src="${escapeHtml(img.image_url)}" alt="Miniatura ${i + 1}" />
        </div>
      `).join("")}
    </div>
  ` : "";

  overlay.innerHTML = `
    <div class="product-detail-modal">
      <button class="product-detail-close-btn" id="closeDetailModalXBtn" aria-label="Cerrar ventana modal">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      <div class="product-detail-grid">
        <!-- Columna Izquierda: Galería -->
        <div class="product-gallery-wrap">
          <div class="product-gallery-main">
            ${mainImageHtml}
          </div>
          ${thumbsHtml}
        </div>

        <!-- Columna Derecha: Información y Contacto -->
        <div class="product-info-column">
          <span class="product-info-category">${escapeHtml(product.category_name ?? "Producto")}</span>
          <h2 class="product-info-title">${escapeHtml(product.name)}</h2>

          <div class="product-info-price-row">
            <span class="product-info-price">${formatPrice(product.price, product.currency)}</span>
            ${product.unit_of_measure ? `<span class="product-info-unit">por ${escapeHtml(product.unit_of_measure)}</span>` : ""}
          </div>

          <div class="product-info-specs">
            <div class="product-spec-item">
              <span class="product-spec-label">Marca</span>
              <span class="product-spec-value">${escapeHtml(product.brand || "—")}</span>
            </div>
            ${product.model ? `
            <div class="product-spec-item">
              <span class="product-spec-label">Modelo</span>
              <span class="product-spec-value">${escapeHtml(product.model)}</span>
            </div>` : ""}
            <div class="product-spec-item">
              <span class="product-spec-label">Disponibilidad</span>
              <span class="product-spec-value">${escapeHtml(product.status ?? "activo")}</span>
            </div>
            <div class="product-spec-item">
              <span class="product-spec-label">Stock en inventario</span>
              <span class="product-spec-value">${product.stock ?? 0} unidades</span>
            </div>
          </div>

          ${product.description ? `
          <div>
            <h3 class="product-info-desc-title">Descripción</h3>
            <p class="product-info-desc">${escapeHtml(product.description)}</p>
          </div>` : ""}

          <!-- Bloque Proveedor -->
          <div class="product-supplier-card">
            <div class="product-supplier-avatar">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7" rx="1.5"/>
                <rect x="14" y="3" width="7" height="7" rx="1.5"/>
                <rect x="3" y="14" width="7" height="7" rx="1.5"/>
                <rect x="14" y="14" width="7" height="7" rx="1.5"/>
              </svg>
            </div>
            <div class="product-supplier-info">
              <p class="product-supplier-name">${escapeHtml(supplier.company_name ?? "Proveedor")}</p>
              <p class="product-supplier-type">${escapeHtml(supplier.supplier_type ?? "Proveedor Registrado")}</p>
            </div>
          </div>

          <!-- Acciones de Contacto (WhatsApp prioritario) -->
          <div class="product-contact-actions">
            ${waLink ? `
            <a href="${escapeHtml(waLink)}" target="_blank" rel="noopener noreferrer" class="btn-whatsapp-contact">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              Contactar por WhatsApp
            </a>` : `
            <button class="btn btn-light-subtle" disabled style="width:100%;">
              Teléfono de contacto no registrado
            </button>`}

            <button class="btn-platform-contact" title="Funcionalidad disponible en una versión futura" disabled>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Contactar mediante la web (Próximamente)
            </button>
          </div>
        </div>
      </div>
    </div>`;

  // Eventos de cierre de modal
  document.getElementById("closeDetailModalXBtn")?.addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  // Eventos de miniaturas de galería
  overlay.querySelectorAll("[data-thumb-src]").forEach((thumb) => {
    thumb.addEventListener("click", () => {
      const src = thumb.dataset.thumbSrc;
      const mainImg = overlay.querySelector("#detailMainImg");
      if (mainImg) mainImg.src = src;

      overlay.querySelectorAll(".product-gallery-thumb").forEach((t) => t.classList.remove("active"));
      thumb.classList.add("active");
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// RATINGS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Carga las estadísticas de rating del proveedor y detecta el rating propio.
 * Renderiza el bloque completo de ratings.
 */
async function loadRatingSection() {
  const container = document.getElementById("ratingSection");
  if (!container) return;

  container.innerHTML = `
    <div class="rating-summary-block">
      <div class="skeleton-line" style="width:40%;height:18px;margin-bottom:16px;"></div>
      <div class="skeleton-line" style="width:100%;height:90px;border-radius:var(--radius-medium);"></div>
    </div>`;

  try {
    // Ejecutar en paralelo: estadísticas + rating propio del usuario
    const [statsRes, myRatingRes] = await Promise.allSettled([
      ratingApi.getRatingStats({ supplier_id: supplierId }),
      currentUser?.id
        ? ratingApi.getRatings({ supplier_id: supplierId, user_id: currentUser.id, pageSize: 1 })
        : Promise.resolve(null),
    ]);

    const stats = statsRes.status === "fulfilled" ? statsRes.value?.data : null;
    const myRatingData = myRatingRes.status === "fulfilled" && myRatingRes.value?.data;
    userExistingRating = (myRatingData && myRatingData.length > 0) ? myRatingData[0] : null;

    renderRatingSection(container, stats);
  } catch (err) {
    console.error("[supplier.js] Error cargando rating:", err);
    container.innerHTML = `
      <div class="rating-summary-block">
        <p style="color:var(--color-text-muted);font-size:0.9rem;">No se pudieron cargar las calificaciones.</p>
      </div>`;
  }
}

/**
 * Renderiza el bloque completo de ratings: estadísticas + selector interactivo.
 * @param {HTMLElement} container
 * @param {{ average: number|null, total: number, distribution: object }|null} stats
 */
function renderRatingSection(container, stats) {
  const avg = parseFloat(stats?.average) || 0;
  const total = stats?.total ?? 0;
  const dist = stats?.distribution ?? {};

  const distRows = [5, 4, 3, 2, 1].map((star) => {
    const count = dist[star] ?? 0;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return `
      <div class="rating-dist-row">
        <span class="rating-dist-label">${star}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b" style="flex-shrink:0;">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
        <div class="rating-dist-bar-track">
          <div class="rating-dist-bar-fill" style="width:${pct}%;"></div>
        </div>
        <span class="rating-dist-count">${count}</span>
      </div>`;
  }).join("");

  const userScore = userExistingRating?.score ?? 0;

  const starsHtml = Array.from({ length: 5 }, (_, i) => {
    const starNum = i + 1;
    const isActive = starNum <= userScore;
    return `
      <button
        class="btn-star ${isActive ? "active" : ""}"
        data-star="${starNum}"
        id="star-btn-${starNum}"
        aria-label="${starNum} ${starNum === 1 ? "estrella" : "estrellas"}"
        title="${starNum} ${starNum === 1 ? "estrella" : "estrellas"}">
        <svg viewBox="0 0 24 24" fill="${isActive ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      </button>`;
  }).join("");

  const ratingStatusText = userExistingRating
    ? `Tu calificación: ${userScore} ${userScore === 1 ? "estrella" : "estrellas"} — haz clic para cambiarla`
    : "Haz clic en una estrella para calificar";

  container.innerHTML = `
    <div class="rating-summary-block">
      <div class="rating-summary-header">
        <h2 class="rating-summary-title">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          Calificaciones
        </h2>
        ${total > 0 ? `<span style="font-size:0.82rem;color:var(--color-text-muted);">${total} calificaci${total === 1 ? "ón" : "ones"}</span>` : ""}
      </div>

      <div class="rating-average-callout">
        <span class="rating-big-score">${avg > 0 ? avg.toFixed(1) : "—"}</span>
        <div class="rating-stars-display">
          <div class="stars-row">${buildStarsSvg(avg)}</div>
          <span class="rating-total-count">${total > 0 ? `${total} calificaci${total === 1 ? "ón" : "ones"}` : "Sin calificaciones aún"}</span>
        </div>
      </div>

      ${total > 0 ? `<div class="rating-distribution">${distRows}</div>` : ""}

      <div class="user-rating-section">
        <span class="user-rating-label">Tu calificación</span>
        <div class="stars-interactive-wrap">
          <div class="stars-interactive" id="starsInteractive" role="group" aria-label="Seleccionar calificación">
            ${starsHtml}
          </div>
          <span class="rating-status-text ${userExistingRating ? "rated" : ""}" id="ratingStatusText">
            ${escapeHtml(ratingStatusText)}
          </span>
        </div>
      </div>
    </div>`;

  initRatingInteraction();
}

/**
 * Inicializa los eventos del selector interactivo de estrellas.
 * Aplica hover, click y actualización de estado.
 */
function initRatingInteraction() {
  const starsWrap = document.getElementById("starsInteractive");
  const statusText = document.getElementById("ratingStatusText");
  if (!starsWrap) return;

  const buttons = starsWrap.querySelectorAll(".btn-star");

  function updateStarsVisual(activeUpTo, persist = false) {
    buttons.forEach((btn) => {
      const num = parseInt(btn.dataset.star, 10);
      const filled = num <= activeUpTo;
      btn.classList.toggle("active", persist && filled);
      btn.classList.toggle("hovered", !persist && filled);
      const svg = btn.querySelector("svg");
      if (svg) {
        svg.setAttribute("fill", filled ? "currentColor" : "none");
      }
    });
  }

  // Hover: iluminar estrellas
  buttons.forEach((btn) => {
    btn.addEventListener("mouseenter", () => {
      if (ratingPending) return;
      updateStarsVisual(parseInt(btn.dataset.star, 10));
    });
  });

  starsWrap.addEventListener("mouseleave", () => {
    if (ratingPending) return;
    updateStarsVisual(userExistingRating?.score ?? 0, true);
  });

  // Click: enviar rating
  buttons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (ratingPending) return;
      const score = parseInt(btn.dataset.star, 10);
      await submitRating(score, buttons, statusText);
    });
  });

  // Estado inicial
  updateStarsVisual(userExistingRating?.score ?? 0, true);
}

/**
 * Envía o actualiza el rating del usuario (upsert).
 * @param {number} score - Valor entre 1 y 5.
 * @param {NodeList} buttons
 * @param {HTMLElement} statusText
 */
async function submitRating(score, buttons, statusText) {
  ratingPending = true;
  buttons.forEach((b) => (b.disabled = true));
  statusText.textContent = "Guardando calificación…";
  statusText.classList.remove("rated");

  try {
    const res = await ratingApi.upsertRating({ supplier_id: supplierId, score });
    userExistingRating = res?.data ?? { score };

    const action = res.status === 201 ? "registrada" : "actualizada";
    notify.success(`Calificación ${action}: ${score} ${score === 1 ? "estrella" : "estrellas"}`);
    statusText.textContent = `Tu calificación: ${score} ${score === 1 ? "estrella" : "estrellas"} — haz clic para cambiarla`;
    statusText.classList.add("rated");

    // Re-cargar estadísticas para reflejar el cambio
    loadRatingSection();
  } catch (err) {
    console.error("[supplier.js] Error al enviar rating:", err);
    const msg = err.status === 401
      ? "Debes iniciar sesión para calificar."
      : err.status === 400
        ? "Calificación inválida. El valor debe ser entre 1 y 5."
        : "No se pudo guardar la calificación. Intenta de nuevo.";
    notify.error(msg);
    statusText.textContent = userExistingRating
      ? `Tu calificación: ${userExistingRating.score} ${userExistingRating.score === 1 ? "estrella" : "estrellas"}`
      : "Haz clic en una estrella para calificar";
    if (userExistingRating) statusText.classList.add("rated");
  } finally {
    ratingPending = false;
    buttons.forEach((b) => (b.disabled = false));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMENTARIOS
// ─────────────────────────────────────────────────────────────────────────────

/** Lista de comentarios cargados actualmente. */
let loadedComments = [];
/** Total de comentarios disponibles en el servidor. */
let totalComments = 0;

/**
 * Carga la sección completa de comentarios (formulario + lista).
 * @param {boolean} [resetPage=true] - Si true, resetea la paginación.
 */
async function loadCommentsSection(resetPage = true) {
  const container = document.getElementById("commentsSection");
  if (!container) return;

  if (resetPage) {
    commentsPage = 1;
    loadedComments = [];
  }

  // En la primera carga, renderizar el esqueleto de la sección completa
  if (commentsPage === 1) {
    container.innerHTML = `
      <div class="comments-section">
        <div class="comments-section-header">
          <h2 class="comments-section-title">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Comentarios
          </h2>
        </div>
        ${buildCommentForm()}
        <div class="comments-list" id="commentsList">
          <div class="comments-loading">${buildCommentSkeletons(3)}</div>
        </div>
      </div>`;

    initCommentFormEvents();
  }

  const listEl = document.getElementById("commentsList");
  if (!listEl) return;

  try {
    const res = await commentApi.getComments({
      supplier_id: supplierId,
      status: "visible",
      page: commentsPage,
      pageSize: COMMENTS_PAGE_SIZE,
      sortBy: "created_at",
      sortOrder: "desc",
    });

    const incoming = res?.data ?? [];
    totalComments = res?.pagination?.totalItems ?? incoming.length;

    if (commentsPage === 1) {
      loadedComments = incoming;
    } else {
      loadedComments = [...loadedComments, ...incoming];
    }

    renderCommentsList(listEl);
    updateCommentsCountBadge();
  } catch (err) {
    console.error("[supplier.js] Error cargando comentarios:", err);
    if (commentsPage === 1) {
      listEl.innerHTML = `
        <div class="comments-empty-state">
          <p style="color:var(--color-text-muted);font-size:0.9rem;">
            No se pudieron cargar los comentarios.
            <button class="btn btn-light-subtle" id="retryCommentsBtn" style="margin-left:8px;">Reintentar</button>
          </p>
        </div>`;
      document.getElementById("retryCommentsBtn")?.addEventListener("click", () => loadCommentsSection(true));
    }
  }
}

/**
 * Construye los skeletons HTML para la lista de comentarios.
 * @param {number} count
 * @returns {string}
 */
function buildCommentSkeletons(count) {
  return Array.from({ length: count }, () => `
    <div class="skeleton-comment-card">
      <div style="display:flex;gap:10px;margin-bottom:12px;">
        <div class="skeleton-circle" style="width:38px;height:38px;flex-shrink:0;"></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:6px;">
          <div class="skeleton-line" style="width:40%;height:14px;"></div>
          <div class="skeleton-line" style="width:25%;height:10px;"></div>
        </div>
      </div>
      <div class="skeleton-line" style="width:100%;height:50px;border-radius:var(--radius-medium);"></div>
    </div>
  `).join("");
}

/**
 * Actualiza el badge con el contador de comentarios.
 */
function updateCommentsCountBadge() {
  const header = document.querySelector(".comments-section-header");
  if (!header) return;

  let badge = header.querySelector(".comments-count-badge");
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "comments-count-badge";
    header.querySelector(".comments-section-title")?.insertAdjacentElement("afterend", badge);
  }
  badge.textContent = `${totalComments} comentario${totalComments !== 1 ? "s" : ""}`;
}

/**
 * Construye el HTML del formulario para crear un nuevo comentario.
 * @returns {string}
 */
function buildCommentForm() {
  return `
    <div class="comment-form-card" id="commentFormCard">
      <h3 class="comment-form-title">Escribe un comentario</h3>
      <form id="commentForm" novalidate>
        <textarea
          id="commentTextarea"
          class="comment-textarea"
          placeholder="Comparte tu experiencia con este proveedor…"
          maxlength="2000"
          rows="3"
          aria-label="Contenido del comentario"
          required></textarea>
        <div class="comment-form-footer">
          <span class="comment-char-counter" id="charCounter">0 / 2000</span>
          <button type="submit" class="btn btn-green-solid" id="submitCommentBtn">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
            Publicar
          </button>
        </div>
      </form>
    </div>`;
}

/**
 * Renderiza la lista completa de comentarios cargados.
 * @param {HTMLElement} listEl
 */
function renderCommentsList(listEl) {
  if (loadedComments.length === 0) {
    listEl.innerHTML = `
      <div class="comments-empty-state">
        <div class="comments-empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <p class="comments-empty-title">Sin comentarios aún</p>
        <p class="comments-empty-sub">Sé el primero en compartir tu experiencia con este proveedor.</p>
      </div>`;
    return;
  }

  const canLoadMore = loadedComments.length < totalComments;

  listEl.innerHTML = loadedComments.map((c) => buildCommentCard(c)).join("") +
    (canLoadMore ? `
      <div class="comments-load-more">
        <button class="btn btn-light-subtle" id="loadMoreCommentsBtn">
          Cargar más comentarios (${totalComments - loadedComments.length} restantes)
        </button>
      </div>` : "");

  // Eventos de acciones en cada comentario
  listEl.querySelectorAll("[data-delete-comment]").forEach((btn) => {
    btn.addEventListener("click", () => handleDeleteComment(btn.dataset.deleteComment));
  });

  listEl.querySelectorAll("[data-edit-comment]").forEach((btn) => {
    btn.addEventListener("click", () => handleEditComment(btn.dataset.editComment));
  });

  // Cargar más
  document.getElementById("loadMoreCommentsBtn")?.addEventListener("click", () => {
    commentsPage += 1;
    loadCommentsSection(false);
  });
}

/**
 * Construye la tarjeta HTML de un comentario individual.
 * @param {object} comment - Objeto Comment de la API.
 * @returns {string}
 */
function buildCommentCard(comment) {
  const isOwn = currentUser?.id && comment.user_id === currentUser.id;
  const initials = getInitials(comment.user?.first_name, comment.user?.last_name);
  const authorName = [comment.user?.first_name, comment.user?.last_name]
    .filter(Boolean)
    .join(" ") || "Usuario";
  const dateStr = formatDate(comment.created_at);

  const avatarHtml = comment.user?.profile_picture_url
    ? `<img src="${escapeHtml(comment.user.profile_picture_url)}" alt="${escapeHtml(authorName)}" />`
    : escapeHtml(initials);

  const ownActions = isOwn ? `
    <div class="comment-actions">
      <button class="btn-comment-action" data-edit-comment="${comment.id}"
        aria-label="Editar mi comentario" title="Editar">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        Editar
      </button>
      <button class="btn-comment-action danger" data-delete-comment="${comment.id}"
        aria-label="Eliminar mi comentario" title="Eliminar">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14H6L5 6"/>
          <path d="M10 11v6M14 11v6"/>
          <path d="M9 6V4h6v2"/>
        </svg>
        Eliminar
      </button>
    </div>` : "";

  return `
    <div class="comment-card ${isOwn ? "is-own" : ""}" id="comment-${comment.id}" data-comment-id="${comment.id}">
      <div class="comment-card-header">
        <div class="comment-author-info">
          <div class="comment-author-avatar">${avatarHtml}</div>
          <div style="min-width:0;">
            <p class="comment-author-name">
              ${escapeHtml(authorName)}
              ${isOwn ? `<span class="you-badge">Tú</span>` : ""}
            </p>
            <p class="comment-date">${escapeHtml(dateStr)}</p>
          </div>
        </div>
        ${ownActions}
      </div>
      <p class="comment-content" id="comment-content-${comment.id}">${escapeHtml(comment.content)}</p>
    </div>`;
}

/**
 * Inicializa los eventos del formulario de comentario.
 */
function initCommentFormEvents() {
  const form = document.getElementById("commentForm");
  const textarea = document.getElementById("commentTextarea");
  const counter = document.getElementById("charCounter");
  const submitBtn = document.getElementById("submitCommentBtn");
  if (!form || !textarea) return;

  // Contador de caracteres
  textarea.addEventListener("input", () => {
    const len = textarea.value.length;
    if (counter) {
      counter.textContent = `${len} / 2000`;
      counter.classList.toggle("near-limit", len >= 1800 && len < 2000);
      counter.classList.toggle("at-limit", len >= 2000);
    }
  });

  // Enviar comentario
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (commentPending) return;

    const content = textarea.value.trim();
    if (!content) {
      notify.warning("El comentario no puede estar vacío.");
      textarea.focus();
      return;
    }
    if (content.length > 2000) {
      notify.warning("El comentario no debe superar los 2000 caracteres.");
      return;
    }

    commentPending = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Publicando…";
    }
    textarea.disabled = true;

    try {
      await commentApi.createComment({ supplier_id: supplierId, content });
      notify.success("Comentario publicado exitosamente.");
      textarea.value = "";
      if (counter) counter.textContent = "0 / 2000";
      // Recargar comentarios desde la primera página
      await loadCommentsSection(true);
    } catch (err) {
      console.error("[supplier.js] Error al crear comentario:", err);
      const msg = err.status === 401
        ? "Debes iniciar sesión para comentar."
        : err.status === 400
          ? err.data?.message ?? "Datos inválidos. Verifica el contenido del comentario."
          : err.status === 404
            ? "El proveedor no existe."
            : "No se pudo publicar el comentario. Intenta de nuevo.";
      notify.error(msg);
    } finally {
      commentPending = false;
      textarea.disabled = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
          Publicar`;
      }
    }
  });
}

/**
 * Activa el modo de edición inline para un comentario propio.
 * @param {string} commentId
 */
function handleEditComment(commentId) {
  const card = document.getElementById(`comment-${commentId}`);
  const contentEl = document.getElementById(`comment-content-${commentId}`);
  if (!card || !contentEl) return;

  // Evitar doble edición
  if (card.querySelector(".comment-edit-area")) return;

  const originalText = contentEl.textContent.trim();
  contentEl.style.display = "none";

  const editArea = document.createElement("textarea");
  editArea.className = "comment-edit-area";
  editArea.value = originalText;
  editArea.maxLength = 2000;
  editArea.id = `edit-area-${commentId}`;
  editArea.setAttribute("aria-label", "Editar comentario");

  const controls = document.createElement("div");
  controls.className = "comment-edit-controls";
  controls.innerHTML = `
    <button class="btn btn-light-subtle" id="cancelEdit-${commentId}" style="font-size:0.85rem;padding:7px 14px;">Cancelar</button>
    <button class="btn btn-green-solid" id="saveEdit-${commentId}" style="font-size:0.85rem;padding:7px 14px;">Guardar</button>`;

  card.appendChild(editArea);
  card.appendChild(controls);
  editArea.focus();

  // Cancelar
  document.getElementById(`cancelEdit-${commentId}`)?.addEventListener("click", () => {
    editArea.remove();
    controls.remove();
    contentEl.style.display = "";
  });

  // Guardar
  document.getElementById(`saveEdit-${commentId}`)?.addEventListener("click", async () => {
    const newContent = editArea.value.trim();
    if (!newContent) {
      notify.warning("El comentario no puede estar vacío.");
      return;
    }
    if (newContent.length > 2000) {
      notify.warning("El comentario no debe superar los 2000 caracteres.");
      return;
    }

    const saveBtn = document.getElementById(`saveEdit-${commentId}`);
    const cancelBtn = document.getElementById(`cancelEdit-${commentId}`);
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Guardando…"; }
    if (cancelBtn) cancelBtn.disabled = true;

    try {
      const res = await commentApi.updateComment(commentId, { content: newContent });
      notify.success("Comentario actualizado.");

      // Actualizar el comentario en la lista local
      const idx = loadedComments.findIndex((c) => c.id === commentId);
      if (idx !== -1 && res?.data) {
        loadedComments[idx] = res.data;
      }

      editArea.remove();
      controls.remove();
      contentEl.textContent = newContent;
      contentEl.style.display = "";
    } catch (err) {
      console.error("[supplier.js] Error al editar comentario:", err);
      const msg = err.status === 403
        ? "No tienes permiso para editar este comentario."
        : err.status === 404
          ? "El comentario ya no existe."
          : "No se pudo actualizar el comentario.";
      notify.error(msg);
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "Guardar"; }
      if (cancelBtn) cancelBtn.disabled = false;
    }
  });
}

/**
 * Elimina un comentario propio con confirmación.
 * @param {string} commentId
 */
async function handleDeleteComment(commentId) {
  const card = document.getElementById(`comment-${commentId}`);
  if (!card) return;

  notify.confirm({
    title: "Eliminar comentario",
    message: "¿Seguro que quieres eliminar este comentario? Esta acción es irreversible.",
    confirmText: "Eliminar",
    cancelText: "Cancelar",
    onConfirm: async () => {
      const deleteBtn = card.querySelector(`[data-delete-comment="${commentId}"]`);
      const editBtn = card.querySelector(`[data-edit-comment="${commentId}"]`);
      if (deleteBtn) { deleteBtn.disabled = true; deleteBtn.textContent = "Eliminando…"; }
      if (editBtn) editBtn.disabled = true;

      try {
        await commentApi.deleteComment(commentId);
        notify.success("Comentario eliminado.");

        // Eliminar de la lista local y re-renderizar
        loadedComments = loadedComments.filter((c) => c.id !== commentId);
        totalComments = Math.max(0, totalComments - 1);

        const listEl = document.getElementById("commentsList");
        if (listEl) renderCommentsList(listEl);
        updateCommentsCountBadge();
      } catch (err) {
        console.error("[supplier.js] Error al eliminar comentario:", err);
        const msg = err.status === 403
          ? "No tienes permiso para eliminar este comentario."
          : err.status === 404
            ? "El comentario ya no existe."
            : "No se pudo eliminar el comentario.";
        notify.error(msg);
        if (deleteBtn) { deleteBtn.disabled = false; deleteBtn.textContent = "Eliminar"; }
        if (editBtn) editBtn.disabled = false;
      }
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// INICIALIZACIÓN
// ─────────────────────────────────────────────────────────────────────────────

function init() {
  const routeData = Router.init();
  if (!routeData) return; // Router.init() ya redirige si no está autenticado

  currentUser = TokenManager.getUser();

  const urlParams = new URLSearchParams(window.location.search);
  supplierId = urlParams.get("id");

  loadSupplierProfile();
}

document.addEventListener("DOMContentLoaded", init);
