/**
 * @file favorites.js
 * @description Módulo de la vista Mis Favoritos (/pages/favorites.html).
 *
 * Dado que el backend no implementa aún un módulo específico de favoritos,
 * esta vista muestra las calificaciones (ratings) que el usuario autenticado
 * ha dejado en proveedores y productos, usando GET /api/v1/ratings/me.
 *
 * Esto sirve como un registro de "proveedores con los que he interactuado",
 * lo cual es funcionalmente equivalente a un historial de favoritos calificados.
 *
 * Responsabilidades:
 *  1. Verificar autenticación vía Router.init().
 *  2. Cargar ratings propios vía ratingApi.getMyRatings().
 *  3. Para cada rating con supplier_id, cargar el perfil del proveedor.
 *  4. Renderizar tarjetas de proveedor calificado con opción de visitar perfil.
 *  5. Permitir eliminar un rating desde esta vista.
 *  6. Manejar estados: carga, vacío, error.
 */

import { ratingApi, homeApi } from "./services/api.js";
import { Router } from "./services/routes.js";
import { notify } from "./services/notificationService.js";

// ─────────────────────────────────────────────────────────────────────────────
// ESTADO LOCAL
// ─────────────────────────────────────────────────────────────────────────────

let favoritesPage = 1;
const FAVORITES_PAGE_SIZE = 12;
let totalFavorites = 0;
let loadedRatings = [];
let isLoading = false;

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
 * Genera HTML de estrellas rellenas/vacías para visualización.
 * @param {number} score - Valor entre 0 y 5.
 * @returns {string}
 */
function buildStarsHtml(score) {
  return Array.from({ length: 5 }, (_, i) => {
    const filled = i < score;
    return `<svg width="16" height="16" viewBox="0 0 24 24"
      fill="${filled ? "#f59e0b" : "none"}"
      stroke="${filled ? "#f59e0b" : "#d1d5db"}"
      stroke-width="1.8" style="flex-shrink:0;">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>`;
  }).join("");
}

/**
 * Formatea una fecha ISO a texto legible en español.
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

// ─────────────────────────────────────────────────────────────────────────────
// SKELETONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inyecta skeletons de carga en el contenedor.
 * @param {HTMLElement} container
 * @param {number} count
 */
function showFavoritesSkeletons(container, count = 6) {
  container.innerHTML = Array.from({ length: count }, () => `
    <div style="
      background:var(--color-bg-card);
      border:1px solid var(--color-border-subtle);
      border-radius:var(--radius-large);
      padding:20px;
      display:flex;
      flex-direction:column;
      gap:12px;">
      <div style="display:flex;gap:12px;align-items:center;">
        <div class="skeleton-circle" style="width:48px;height:48px;flex-shrink:0;"></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:8px;">
          <div class="skeleton-line" style="width:60%;height:14px;"></div>
          <div class="skeleton-line" style="width:40%;height:10px;"></div>
        </div>
      </div>
      <div class="skeleton-line" style="width:80%;height:18px;border-radius:var(--radius-small);"></div>
      <div class="skeleton-line" style="width:50%;height:10px;border-radius:var(--radius-small);"></div>
    </div>
  `).join("");
}

// ─────────────────────────────────────────────────────────────────────────────
// CARGA DE DATOS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Carga los ratings del usuario y renderiza la vista de favoritos.
 * @param {boolean} [reset=true] - Si true, reinicia la paginación.
 */
async function loadFavorites(reset = true) {
  if (isLoading) return;

  const grid = document.getElementById("favoritesGrid");
  if (!grid) return;

  if (reset) {
    favoritesPage = 1;
    loadedRatings = [];
    showFavoritesSkeletons(grid, 6);
  }

  isLoading = true;
  updateLoadMoreBtn(true);

  try {
    const res = await ratingApi.getMyRatings({
      page: favoritesPage,
      pageSize: FAVORITES_PAGE_SIZE,
      sortBy: "created_at",
      sortOrder: "desc",
    });

    const incoming = res?.data ?? [];
    totalFavorites = res?.pagination?.totalItems ?? incoming.length;

    if (reset) {
      loadedRatings = incoming;
    } else {
      loadedRatings = [...loadedRatings, ...incoming];
    }

    // Para ratings de proveedores, intentar enriquecer con datos del perfil
    await enrichWithSupplierData(incoming);

    renderFavoritesList(grid, reset);
  } catch (err) {
    console.error("[favorites.js] Error cargando favoritos:", err);
    const msg = err.status === 401
      ? "Tu sesión expiró. Inicia sesión de nuevo."
      : "No se pudieron cargar tus calificaciones. Intenta de nuevo.";

    if (reset) {
      grid.innerHTML = `
        <div class="fav-empty-state" style="grid-column:1/-1;">
          <div class="fav-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <p class="fav-empty-title">Error al cargar</p>
          <p class="fav-empty-sub">${escapeHtml(msg)}</p>
          <button class="btn btn-light-subtle" id="retryFavBtn" style="margin-top:16px;">Reintentar</button>
        </div>`;
      document.getElementById("retryFavBtn")?.addEventListener("click", () => loadFavorites(true));
    }
  } finally {
    isLoading = false;
    updateLoadMoreBtn(false);
  }
}

/**
 * Mapa en memoria de perfiles de proveedor ya cargados (caché simple).
 * @type {Map<string, object>}
 */
const supplierCache = new Map();

/**
 * Enriquece los ratings con información del perfil del proveedor correspondiente.
 * Usa un caché en memoria para evitar peticiones duplicadas.
 * @param {Array<object>} ratings
 */
async function enrichWithSupplierData(ratings) {
  const supplierIds = [...new Set(
    ratings.filter((r) => r.supplier_id && !supplierCache.has(r.supplier_id)).map((r) => r.supplier_id)
  )];

  if (supplierIds.length === 0) return;

  await Promise.allSettled(
    supplierIds.map(async (id) => {
      try {
        const res = await homeApi.getSupplierProfile(id);
        if (res?.data) supplierCache.set(id, res.data);
      } catch {
        // Si falla, se muestra el rating sin datos del proveedor
        console.warn(`[favorites.js] No se pudo cargar proveedor ${id}`);
      }
    })
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDERIZADO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renderiza la grilla de favoritos.
 * @param {HTMLElement} grid
 * @param {boolean} reset
 */
function renderFavoritesList(grid, reset) {
  if (loadedRatings.length === 0) {
    grid.innerHTML = `
      <div class="fav-empty-state" style="grid-column:1/-1;">
        <div class="fav-empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </div>
        <p class="fav-empty-title">Sin calificaciones aún</p>
        <p class="fav-empty-sub">
          Visita el perfil de un proveedor y deja tu calificación para verlo aquí.
        </p>
        <a href="home.html" class="btn btn-green-solid" style="margin-top:16px;text-decoration:none;">
          Explorar proveedores
        </a>
      </div>`;
    updatePageCounter(0);
    return;
  }

  const canLoadMore = loadedRatings.length < totalFavorites;

  const cardsHtml = loadedRatings.map((rating) => buildFavoriteCard(rating)).join("");

  const loadMoreHtml = canLoadMore ? `
    <div style="grid-column:1/-1;text-align:center;margin-top:8px;">
      <button class="btn btn-light-subtle" id="loadMoreFavBtn">
        Cargar más (${totalFavorites - loadedRatings.length} restantes)
      </button>
    </div>` : "";

  grid.innerHTML = cardsHtml + loadMoreHtml;

  // Eventos de eliminación
  grid.querySelectorAll("[data-delete-rating]").forEach((btn) => {
    btn.addEventListener("click", () => handleDeleteRating(btn.dataset.deleteRating));
  });

  // Cargar más
  document.getElementById("loadMoreFavBtn")?.addEventListener("click", () => {
    favoritesPage += 1;
    loadFavorites(false);
  });

  updatePageCounter(totalFavorites);
}

/**
 * Construye la tarjeta HTML de un rating/favorito.
 * @param {object} rating - Objeto Rating de la API.
 * @returns {string}
 */
function buildFavoriteCard(rating) {
  const supplier = rating.supplier_id ? supplierCache.get(rating.supplier_id) : null;
  const hasSupplier = !!supplier;

  const name = hasSupplier
    ? (supplier.company_name ?? "Proveedor")
    : (rating.supplier_id ? "Proveedor" : `Producto calificado`);

  const subtitle = hasSupplier
    ? (supplier.supplier_type ?? "")
    : (rating.product_id ? "Producto" : "");

  const profileUrl = rating.supplier_id
    ? `supplier/supplier.html?id=${encodeURIComponent(rating.supplier_id)}`
    : "#";

  const dateStr = formatDate(rating.created_at);
  const starsHtml = buildStarsHtml(rating.score);

  const coverageMap = { local: "Local", regional: "Regional", national: "Nacional" };
  const coverage = hasSupplier
    ? (coverageMap[supplier.geographic_coverage] ?? "")
    : "";

  return `
    <article class="fav-card" id="fav-rating-${rating.id}">
      <div class="fav-card-header">
        <div class="fav-card-logo">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
            <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/>
            <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/>
            <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/>
            <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/>
          </svg>
        </div>
        <div class="fav-card-meta">
          <h3 class="fav-card-name">${escapeHtml(name)}</h3>
          ${subtitle ? `<p class="fav-card-subtitle">${escapeHtml(subtitle)}</p>` : ""}
        </div>
      </div>

      <div class="fav-card-rating">
        <div style="display:flex;gap:3px;align-items:center;">${starsHtml}</div>
        <span class="fav-card-score">${rating.score} / 5</span>
      </div>

      ${coverage ? `
      <p class="fav-card-coverage">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M12 21s-7-4.6-7-11a7 7 0 1 1 14 0c0 6.4-7 11-7 11Z"/>
          <circle cx="12" cy="10" r="2.4"/>
        </svg>
        Cobertura ${escapeHtml(coverage)}
      </p>` : ""}

      <p class="fav-card-date">Calificado el ${escapeHtml(dateStr)}</p>

      <div class="fav-card-actions">
        ${rating.supplier_id ? `
        <a href="${escapeHtml(profileUrl)}" class="btn btn-green-solid fav-btn-visit" style="flex:1;text-decoration:none;font-size:0.85rem;padding:8px 12px;">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          Ver perfil
        </a>` : ""}
        <button
          class="btn fav-btn-remove"
          data-delete-rating="${rating.id}"
          aria-label="Eliminar calificación"
          title="Eliminar calificación"
          style="padding:8px 12px;font-size:0.82rem;">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
          Quitar
        </button>
      </div>
    </article>`;
}

/**
 * Actualiza el contador de calificaciones en el header.
 * @param {number} count
 */
function updatePageCounter(count) {
  const counter = document.getElementById("favoritesCounter");
  if (counter) {
    counter.textContent = count > 0
      ? `${count} calificaci${count === 1 ? "ón" : "ones"}`
      : "";
  }
}

/**
 * Habilita o deshabilita el botón de "cargar más" visualmente.
 * @param {boolean} loading
 */
function updateLoadMoreBtn(loading) {
  const btn = document.getElementById("loadMoreFavBtn");
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? "Cargando…" : btn.textContent;
}

// ─────────────────────────────────────────────────────────────────────────────
// ACCIONES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Elimina un rating del historial con confirmación.
 * @param {string} ratingId
 */
async function handleDeleteRating(ratingId) {
  const card = document.getElementById(`fav-rating-${ratingId}`);
  const deleteBtn = card?.querySelector(`[data-delete-rating="${ratingId}"]`);

  notify.confirm({
    title: "Quitar calificación",
    message: "¿Quieres eliminar esta calificación? No se puede deshacer.",
    confirmText: "Quitar",
    cancelText: "Cancelar",
    onConfirm: async () => {
      if (deleteBtn) { deleteBtn.disabled = true; deleteBtn.textContent = "Quitando…"; }

      try {
        await ratingApi.deleteRating(ratingId);
        notify.success("Calificación eliminada.");

        loadedRatings = loadedRatings.filter((r) => r.id !== ratingId);
        totalFavorites = Math.max(0, totalFavorites - 1);

        // Animar salida de la tarjeta
        if (card) {
          card.style.transition = "opacity 0.3s, transform 0.3s";
          card.style.opacity = "0";
          card.style.transform = "scale(0.95)";
          setTimeout(() => {
            const grid = document.getElementById("favoritesGrid");
            if (grid) renderFavoritesList(grid, false);
          }, 300);
        }
      } catch (err) {
        console.error("[favorites.js] Error al eliminar rating:", err);
        const msg = err.status === 403
          ? "No tienes permiso para eliminar esta calificación."
          : err.status === 404
            ? "Esta calificación ya no existe."
            : "No se pudo eliminar. Intenta de nuevo.";
        notify.error(msg);
        if (deleteBtn) { deleteBtn.disabled = false; deleteBtn.textContent = "Quitar"; }
      }
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// INICIALIZACIÓN
// ─────────────────────────────────────────────────────────────────────────────

function init() {
  const routeData = Router.init();
  if (!routeData) return;

  loadFavorites(true);
}

document.addEventListener("DOMContentLoaded", init);
