/**
 * @file homeSupplier.js
 * @description Panel principal del Proveedor (Dashboard & Gestión de Catálogo de Productos).
 *
 * Flujo:
 *  1. Verifica autenticación y guard de rol. Obtiene la empresa y el perfil de proveedor del usuario.
 *  2. Si no posee perfil de proveedor, redirige a /pages/supplier/createSupplier.html.
 *  3. Muestra métricas clave del proveedor (Total productos, Activos, Agotados/Inactivos).
 *  4. Carga y renderiza el catálogo de productos pertenientes ÚNICAMENTE al proveedor autenticado.
 *  5. Permite crear, editar, cambiar estado, gestionar imágenes y eliminar productos.
 */

import { TokenManager, homeApi } from "../services/api.js";
import { companyService } from "../services/companyService.js";
import { supplierService } from "../services/supplierService.js";
import { NotificationManager } from "../services/notificationService.js";
import { Router } from "../services/routes.js";

// Estado interno del módulo
const state = {
  user: null,
  company: null,
  supplier: null,
  categories: [],
  products: [],
  filteredProducts: [],
  activeProductId: null,
  isSubmitting: false,
};

/** Escapa HTML para prevenir ataques XSS */
function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Formatea número a precio decimal */
function formatPrice(val, currency = "USD") {
  const num = parseFloat(val) || 0;
  const symbolMap = { USD: "$", HNL: "L", EUR: "€" };
  const symbol = symbolMap[currency] || `${currency} `;
  return `${symbol}${num.toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Genera representación en estrellas del rating */
function buildStars(rating) {
  const rounded = Math.round(parseFloat(rating) || 0);
  return "★".repeat(Math.min(rounded, 5)) + "☆".repeat(Math.max(0, 5 - rounded));
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH & ACCESS GUARD
// ─────────────────────────────────────────────────────────────────────────────

async function initAccessGuard() {
  if (!TokenManager.isAuthenticated()) {
    window.location.href = "/pages/login.html";
    return false;
  }

  const user = TokenManager.getUser();
  if (!user || !user.id) {
    window.location.href = "/pages/login.html";
    return false;
  }
  state.user = user;

  try {
    const company = await companyService.getByUserId(user.id);
    if (!company) {
      window.location.href = "/pages/supplier/createSupplier.html";
      return false;
    }
    state.company = company;

    const supplier = await supplierService.getByCompanyId(company.id);
    if (!supplier) {
      window.location.href = "/pages/supplier/createSupplier.html";
      return false;
    }
    state.supplier = supplier;

    return true;
  } catch (err) {
    console.error("[homeSupplier.js] Error al verificar guard de proveedor:", err);
    NotificationManager.error("Ocurrió un error al verificar tu cuenta de proveedor.");
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HERO & DASHBOARD STATS RENDER
// ─────────────────────────────────────────────────────────────────────────────

function renderHeroAndStats() {
  const container = document.getElementById("supplier-hero-container");
  if (!container || !state.supplier || !state.company) return;

  const { company } = state;
  const { supplier } = state;
  const rating = parseFloat(supplier.average_rating) || 0;

  const totalProds = state.products.length;
  const activeProds = state.products.filter((p) => p.status === "activo" || p.status === "disponible").length;
  const outOfStockProds = state.products.filter((p) => p.status === "agotado" || p.status === "no disponible").length;

  container.innerHTML = `
    <div class="supplier-hero-card">
      <div class="supplier-hero-header">
        <div class="supplier-info-meta">
          <div class="supplier-avatar-box">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
            </svg>
          </div>
          <div>
            <h1 class="supplier-hero-title">${escapeHtml(company.name)}</h1>
            <div class="supplier-hero-subtitle">
              <span>${escapeHtml(supplier.supplier_type ?? "Proveedor Registrado")}</span>
              <span>•</span>
              <span style="color: #4ade80;">${starsToBadge(rating)}</span>
              <span>•</span>
              <span>Cobertura: <strong style="color: #cbd5e1; text-transform: uppercase;">${escapeHtml(supplier.geographic_coverage)}</strong></span>
            </div>
          </div>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Productos</div>
          <div class="stat-value">${totalProds}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Productos Activos</div>
          <div class="stat-value" style="color: #4ade80;">${activeProds}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Agotados / Inactivos</div>
          <div class="stat-value" style="color: #f87171;">${outOfStockProds}</div>
        </div>
      </div>
    </div>
  `;
}

function starsToBadge(rating) {
  return rating > 0 ? `${rating.toFixed(1)} ${buildStars(rating)}` : "Sin calificaciones";
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORIES & FILTERS
// ─────────────────────────────────────────────────────────────────────────────

async function loadCategories() {
  try {
    const res = await homeApi.getCategories();
    state.categories = res?.data ?? res ?? [];

    const filterSelect = document.getElementById("filter-category-select");
    const formSelect = document.getElementById("product-form-category");

    const optionsHtml = state.categories
      .map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
      .join("");

    if (filterSelect) {
      filterSelect.innerHTML = `<option value="">Todas las categorías</option>${optionsHtml}`;
    }
    if (formSelect) {
      formSelect.innerHTML = `<option value="">Selecciona categoría</option>${optionsHtml}`;
    }
  } catch (err) {
    console.error("[homeSupplier.js] Error al cargar categorías:", err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CATALOG LOADING & FILTERING
// ─────────────────────────────────────────────────────────────────────────────

async function loadProducts() {
  const container = document.getElementById("catalog-container");
  if (!container || !state.supplier) return;

  container.innerHTML = `
    <div style="text-align: center; padding: 48px 16px;">
      <div class="spinner-inline" style="width: 32px; height: 32px; border-width: 3px; margin-bottom: 12px;"></div>
      <p style="color: #64748b; font-size: 0.9rem;">Cargando tu catálogo de productos...</p>
    </div>
  `;

  try {
    const res = await homeApi.getProductsBySupplier(state.supplier.id);
    state.products = res?.data ?? [];
    applyFilters();
    renderHeroAndStats();
  } catch (err) {
    console.error("[homeSupplier.js] Error al cargar catálogo:", err);
    container.innerHTML = `
      <div class="empty-catalog-box">
        <p style="color: #ef4444; font-weight: 600;">Ocurrió un error al cargar tus productos.</p>
        <button id="btn-retry-catalog" class="btn btn-outline" style="margin-top: 12px;">Reintentar</button>
      </div>
    `;
    document.getElementById("btn-retry-catalog")?.addEventListener("click", loadProducts);
  }
}

function applyFilters() {
  const searchVal = (document.getElementById("catalog-search-input")?.value || "").toLowerCase().trim();
  const categoryVal = document.getElementById("filter-category-select")?.value || "";
  const statusVal = document.getElementById("filter-status-select")?.value || "";

  state.filteredProducts = state.products.filter((p) => {
    const matchesSearch =
      !searchVal ||
      p.name?.toLowerCase().includes(searchVal) ||
      p.description?.toLowerCase().includes(searchVal) ||
      p.brand?.toLowerCase().includes(searchVal);

    const matchesCategory = !categoryVal || p.category_id === categoryVal;
    const matchesStatus = !statusVal || p.status === statusVal;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  renderCatalog();
}

function renderCatalog() {
  const container = document.getElementById("catalog-container");
  if (!container) return;

  if (state.filteredProducts.length === 0) {
    if (state.products.length === 0) {
      container.innerHTML = `
        <div class="empty-catalog-box">
          <div class="empty-catalog-icon">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
            </svg>
          </div>
          <h3 class="empty-catalog-title">Tu catálogo de productos está vacío</h3>
          <p class="empty-catalog-sub">Comienza a publicar los productos que ofreces para que los clientes puedan encontrarte y solicitar cotizaciones.</p>
          <button class="btn-primary-gradient btn-trigger-add">
            + Registrar mi primer producto
          </button>
        </div>
      `;
      container.querySelector(".btn-trigger-add")?.addEventListener("click", openAddProductModal);
    } else {
      container.innerHTML = `
        <div class="empty-catalog-box">
          <h3 class="empty-catalog-title">No se encontraron productos</h3>
          <p class="empty-catalog-sub">No hay productos que coincidan con los filtros seleccionados.</p>
        </div>
      `;
    }
    return;
  }

  const categoryMap = new Map(state.categories.map((c) => [c.id, c.name]));

  container.innerHTML = `
    <div class="catalog-grid">
      ${state.filteredProducts
        .map((p) => {
          const categoryName = categoryMap.get(p.category_id) || p.category_name || "Producto";
          const statusClass = `badge-${(p.status || "activo").replace(/\s+/g, "_")}`;
          const imgUrl = p.primary_image_url || "/assets/images/placeholder-product.jpg";

          return `
            <article class="product-card">
              <div class="product-card-img-wrap">
                <img
                  src="${escapeHtml(imgUrl)}"
                  alt="${escapeHtml(p.name)}"
                  class="product-card-img"
                  onerror="this.src='https://images.unsplash.com/photo-1560343090-f0409e92791a?w=400&q=80'"
                />
                <span class="product-card-badge ${statusClass}">
                  ${escapeHtml(p.status || "activo")}
                </span>
              </div>
              <div class="product-card-body">
                <div class="product-category-tag">${escapeHtml(categoryName)}</div>
                <h3 class="product-card-title">${escapeHtml(p.name)}</h3>
                <p class="product-card-desc">${escapeHtml(p.description || "Sin descripción.")}</p>
                
                <div class="product-meta-row">
                  <div>
                    <span class="product-price">${formatPrice(p.price, p.currency)}</span>
                    <span style="font-size:0.75rem; color:#64748b;"> / ${escapeHtml(p.unit_of_measure)}</span>
                  </div>
                  <div class="product-stock">Stock: <b>${p.stock}</b></div>
                </div>
              </div>

              <div class="product-card-actions">
                <button class="btn-card-action btn-edit-prod" data-id="${p.id}" title="Editar Producto">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Editar
                </button>
                <button class="btn-card-action btn-images-prod" data-id="${p.id}" title="Gestionar Fotos">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  Fotos
                </button>
                <button class="btn-card-action danger btn-delete-prod" data-id="${p.id}" data-name="${escapeHtml(p.name)}" title="Eliminar Producto">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;

  // Asignar listeners a los botones de acción
  container.querySelectorAll(".btn-edit-prod").forEach((btn) => {
    btn.addEventListener("click", () => openEditProductModal(btn.dataset.id));
  });
  container.querySelectorAll(".btn-images-prod").forEach((btn) => {
    btn.addEventListener("click", () => openImagesModal(btn.dataset.id));
  });
  container.querySelectorAll(".btn-delete-prod").forEach((btn) => {
    btn.addEventListener("click", () => openDeleteModal(btn.dataset.id, btn.dataset.name));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL SYSTEM & HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
  }
}

function initModalEvents() {
  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", () => {
      closeModal(btn.dataset.closeModal);
    });
  });

  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeModal(overlay.id);
      }
    });
  });
}

// ── PRODUCT CREATE / EDIT MODAL ──────────────────────────────────────────────

function openAddProductModal() {
  const form = document.getElementById("productForm");
  if (!form) return;

  form.reset();
  document.getElementById("product-form-id").value = "";
  document.getElementById("productModalTitle").textContent = "Publicar Nuevo Producto";
  document.getElementById("btn-save-text").textContent = "Publicar Producto";
  document.getElementById("group-initial-image").style.display = "block";

  openModal("productModal");
}

function openEditProductModal(productId) {
  const product = state.products.find((p) => p.id === productId);
  if (!product) return;

  document.getElementById("product-form-id").value = product.id;
  document.getElementById("product-form-name").value = product.name || "";
  document.getElementById("product-form-category").value = product.category_id || "";
  document.getElementById("product-form-brand").value = product.brand || "";
  document.getElementById("product-form-price").value = product.price || 0;
  document.getElementById("product-form-currency").value = product.currency || "USD";
  document.getElementById("product-form-stock").value = product.stock || 0;
  document.getElementById("product-form-unit").value = product.unit_of_measure || "";
  document.getElementById("product-form-model").value = product.model || "";
  document.getElementById("product-form-desc").value = product.description || "";

  document.getElementById("productModalTitle").textContent = "Editar Producto";
  document.getElementById("btn-save-text").textContent = "Guardar Cambios";
  document.getElementById("group-initial-image").style.display = "none";

  openModal("productModal");
}

async function handleProductFormSubmit(e) {
  e.preventDefault();
  if (state.isSubmitting) return;

  const productId = document.getElementById("product-form-id").value;
  const isEditing = Boolean(productId);

  const payload = {
    supplier_id: state.supplier.id,
    category_id: document.getElementById("product-form-category").value,
    name: document.getElementById("product-form-name").value.trim(),
    brand: document.getElementById("product-form-brand").value.trim(),
    price: parseFloat(document.getElementById("product-form-price").value),
    currency: document.getElementById("product-form-currency").value,
    stock: parseFloat(document.getElementById("product-form-stock").value),
    unit_of_measure: document.getElementById("product-form-unit").value.trim(),
    model: document.getElementById("product-form-model").value.trim() || undefined,
    description: document.getElementById("product-form-desc").value.trim(),
  };

  if (!isEditing) {
    const imageUrl = document.getElementById("product-form-image").value.trim();
    if (imageUrl) payload.image_url = imageUrl;
  }

  const saveBtn = document.getElementById("btn-save-product");
  saveBtn.disabled = true;
  state.isSubmitting = true;

  try {
    if (isEditing) {
      delete payload.supplier_id; // No cambiar de proveedor al editar
      await homeApi.updateProduct(productId, payload);
      NotificationManager.success("Producto actualizado correctamente.");
    } else {
      await homeApi.addProduct(payload);
      NotificationManager.success("¡Producto publicado exitosamente!");
    }

    closeModal("productModal");
    await loadProducts();
  } catch (err) {
    console.error("[homeSupplier.js] Error al guardar producto:", err);
    NotificationManager.error(err.message || "No se pudo guardar el producto.");
  } finally {
    saveBtn.disabled = false;
    state.isSubmitting = false;
  }
}

// ── IMAGES MANAGEMENT MODAL ──────────────────────────────────────────────────

async function openImagesModal(productId) {
  state.activeProductId = productId;
  document.getElementById("images-product-id").value = productId;
  document.getElementById("addImageForm").reset();

  openModal("imagesModal");
  await renderProductImagesList(productId);
}

async function renderProductImagesList(productId) {
  const container = document.getElementById("images-gallery-container");
  if (!container) return;

  container.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:16px;"><span class="spinner-inline"></span> Cargando fotos...</div>`;

  try {
    const res = await homeApi.getProductImages(productId);
    const images = res?.data ?? [];

    if (images.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; color: #64748b; font-size: 0.88rem; padding: 16px; background: #f8fafc; border-radius: 8px;">
          Este producto aún no tiene fotos en su galería.
        </div>
      `;
      return;
    }

    container.innerHTML = images
      .map(
        (img) => `
        <div class="gallery-item">
          <img src="${escapeHtml(img.image_url)}" alt="Foto del producto" onerror="this.src='https://images.unsplash.com/photo-1560343090-f0409e92791a?w=400&q=80'" />
          ${img.is_primary ? `<span class="gallery-primary-badge">Principal</span>` : ""}
          <button type="button" class="gallery-item-delete btn-delete-img" data-img-id="${img.id}" title="Eliminar foto">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      `,
      )
      .join("");

    container.querySelectorAll(".btn-delete-img").forEach((btn) => {
      btn.addEventListener("click", () => handleDeleteProductImage(btn.dataset.imgId));
    });
  } catch (err) {
    console.error("[homeSupplier.js] Error al cargar imágenes:", err);
    container.innerHTML = `<div style="grid-column:1/-1; color:#ef4444;">Error al cargar las fotos.</div>`;
  }
}

async function handleAddImageSubmit(e) {
  e.preventDefault();
  const productId = state.activeProductId;
  const imageUrl = document.getElementById("new-image-url").value.trim();
  const isPrimary = document.getElementById("new-image-primary").checked;

  if (!imageUrl || !productId) return;

  const btn = document.getElementById("btn-add-image");
  btn.disabled = true;

  try {
    await homeApi.addProductImage(productId, {
      image_url: imageUrl,
      is_primary: isPrimary,
    });
    NotificationManager.success("Imagen agregada correctamente.");
    document.getElementById("addImageForm").reset();
    await renderProductImagesList(productId);
    await loadProducts(); // refrescar tarjeta si cambió la primaria
  } catch (err) {
    console.error("[homeSupplier.js] Error al agregar imagen:", err);
    NotificationManager.error(err.message || "No se pudo agregar la imagen.");
  } finally {
    btn.disabled = false;
  }
}

async function handleDeleteProductImage(imageId) {
  const productId = state.activeProductId;
  if (!productId || !imageId) return;

  try {
    await homeApi.deleteProductImage(productId, imageId);
    NotificationManager.success("Imagen eliminada de la galería.");
    await renderProductImagesList(productId);
    await loadProducts();
  } catch (err) {
    console.error("[homeSupplier.js] Error al eliminar imagen:", err);
    NotificationManager.error("No se pudo eliminar la imagen.");
  }
}

// ── DELETE PRODUCT MODAL ─────────────────────────────────────────────────────

function openDeleteModal(productId, productName) {
  state.activeProductId = productId;
  document.getElementById("delete-product-name").textContent = productName;
  openModal("deleteConfirmModal");
}

async function handleConfirmDelete() {
  const productId = state.activeProductId;
  if (!productId) return;

  const btn = document.getElementById("btn-confirm-delete");
  btn.disabled = true;

  try {
    await homeApi.deleteProduct(productId);
    NotificationManager.success("Producto eliminado del catálogo.");
    closeModal("deleteConfirmModal");
    await loadProducts();
  } catch (err) {
    console.error("[homeSupplier.js] Error al eliminar producto:", err);
    NotificationManager.error(err.message || "No se pudo eliminar el producto.");
  } finally {
    btn.disabled = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INICIALIZACIÓN DEL MÓDULO
// ─────────────────────────────────────────────────────────────────────────────

async function init() {
  Router.init();

  const isAllowed = await initAccessGuard();
  const loadingOverlay = document.getElementById("page-loading-overlay");

  if (!isAllowed) {
    if (loadingOverlay) loadingOverlay.style.display = "none";
    return;
  }

  // Inicializar listeners de interfaz
  initModalEvents();

  document.getElementById("btn-open-add-product")?.addEventListener("click", openAddProductModal);
  document.getElementById("productForm")?.addEventListener("submit", handleProductFormSubmit);
  document.getElementById("addImageForm")?.addEventListener("submit", handleAddImageSubmit);
  document.getElementById("btn-confirm-delete")?.addEventListener("click", handleConfirmDelete);

  document.getElementById("catalog-search-input")?.addEventListener("input", applyFilters);
  document.getElementById("filter-category-select")?.addEventListener("change", applyFilters);
  document.getElementById("filter-status-select")?.addEventListener("change", applyFilters);

  // Cargar datos
  await loadCategories();
  await loadProducts();

  if (loadingOverlay) {
    loadingOverlay.style.opacity = "0";
    setTimeout(() => {
      loadingOverlay.style.display = "none";
    }, 300);
  }
}

document.addEventListener("DOMContentLoaded", init);
