/**
 * @file homeSupplier.js
 * @description Panel principal del Proveedor (Dashboard & Gestión de Catálogo de Productos).
 *
 * Flujo:
 *  1. Verifica autenticación y guard de rol. Obtiene la empresa y el perfil de proveedor del usuario.
 *  2. Si no posee perfil de proveedor, redirige a /pages/supplier/createSupplier.html.
 *  3. Muestra métricas clave del proveedor (Total productos, Activos, Agotados/Inactivos).
 *  4. Carga y renderiza el catálogo de productos pertenecientes ÚNICAMENTE al proveedor autenticado.
 *  5. Permite crear, editar, cambiar estado, gestionar múltiples imágenes (Supabase Storage) y eliminar productos.
 */

import { TokenManager, homeApi } from "../services/api.js";
import { companyService } from "../services/companyService.js";
import { supplierService } from "../services/supplierService.js";
import { uploadMultipleProductImages } from "../services/storageService.js";
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
  selectedImageFiles: [],
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

function starsToBadge(rating) {
  return rating > 0 ? `${rating.toFixed(1)} ${buildStars(rating)}` : "Sin calificaciones";
}

/** Mapea los status de la DB a etiquetas amigables en español */
function statusLabel(status) {
  const labels = {
    active:       "Activo",
    inactive:     "Inactivo",
    out_of_stock: "Agotado",
  };
  return labels[status] ?? escapeHtml(status);
}

/** Clase CSS para el badge según el status de la DB */
function statusBadgeClass(status) {
  const classes = {
    active:       "badge-active",
    inactive:     "badge-inactive",
    out_of_stock: "badge-out_of_stock",
  };
  return classes[status] ?? "badge-inactive";
}


// ─────────────────────────────────────────────────────────────────────────────
// AUTH & ACCESS GUARD
// ─────────────────────────────────────────────────────────────────────────────

async function initAccessGuard() {
  if (!TokenManager.isAuthenticated()) {
    window.location.href = "../login.html";
    return false;
  }

  const user = TokenManager.getUser();
  if (!user || !user.id) {
    window.location.href = "../login.html";
    return false;
  }
  state.user = user;

  try {
    const company = await companyService.getByUserId(user.id);
    if (!company) {
      window.location.href = "createSupplier.html";
      return false;
    }
    state.company = company;

    const supplier = await supplierService.getByCompanyId(company.id);
    if (!supplier) {
      window.location.href = "createSupplier.html";
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

  const { company, supplier } = state;
  const rating = parseFloat(supplier.average_rating) || 0;

  const totalProds = state.products.length;
  const activeProds = state.products.filter((p) => p.status === "active").length;
  const outOfStockProds = state.products.filter((p) => p.status === "out_of_stock" || p.status === "inactive").length;

  container.innerHTML = `
    <div class="supplier-hero-card">
      <div class="supplier-hero-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:16px;">
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
              <span>Verificación: <strong style="color: ${company.verification_status === 'verified' ? '#4ade80' : '#f59e0b'};">${company.verification_status === 'verified' ? '✓ Verificado' : 'Sin Verificar'}</strong></span>
            </div>
          </div>
        </div>

        <div>
          <a href="verification.html" class="btn-primary-gradient" style="text-decoration:none; display:inline-flex; align-items:center; gap:8px; padding:10px 18px; font-size:0.9rem;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            ${company.verification_status === 'verified' ? 'Suscripción Verificada' : 'Obtener Verificación'}
          </a>
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
      <div class="spinner-inline" style="width: 32px; height: 32px; border-width: 3px; border-top-color: #6366f1; margin-bottom: 12px;"></div>
      <p style="color: #64748b; font-size: 0.9rem;">Cargando tu catálogo de productos...</p>
    </div>
  `;

  try {
    // Usa /products/mine — el backend deriva supplier_id del JWT, no del cliente
    const res = await homeApi.getMyProducts();
    state.products = res?.data ?? [];

    // Si el backend retorna el supplier_id resuelto, actualizar estado
    if (res?.supplier_id && state.supplier) {
      state.supplier.id = res.supplier_id;
    }

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
          const badgeClass = statusBadgeClass(p.status);
          const badgeText = statusLabel(p.status);
          const imgUrl = p.primary_image_url || p.image_url || "https://images.unsplash.com/photo-1560343090-f0409e92791a?w=400&q=80";

          return `
            <article class="product-card">
              <div class="product-card-img-wrap">
                <img
                  src="${escapeHtml(imgUrl)}"
                  alt="${escapeHtml(p.name)}"
                  class="product-card-img"
                  onerror="this.src='https://images.unsplash.com/photo-1560343090-f0409e92791a?w=400&q=80'"
                />
                <span class="product-card-badge ${badgeClass}">
                  ${badgeText}
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

  // Listeners
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

function clearFieldErrors() {
  document.querySelectorAll(".field-error-msg").forEach((el) => (el.textContent = ""));
}

// ── PRODUCT CREATE / EDIT MODAL ──────────────────────────────────────────────

function openAddProductModal() {
  const form = document.getElementById("productForm");
  if (!form) return;

  clearFieldErrors();
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

  clearFieldErrors();
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

  clearFieldErrors();

  const productId = document.getElementById("product-form-id").value;
  const isEditing = Boolean(productId);

  const name = document.getElementById("product-form-name").value.trim();
  const categoryId = document.getElementById("product-form-category").value;
  const brand = document.getElementById("product-form-brand").value.trim();
  const priceVal = parseFloat(document.getElementById("product-form-price").value);
  const currency = document.getElementById("product-form-currency").value;
  const stockVal = parseInt(document.getElementById("product-form-stock").value, 10);
  const unitOfMeasure = document.getElementById("product-form-unit").value.trim();
  const model = document.getElementById("product-form-model").value.trim();
  const description = document.getElementById("product-form-desc").value.trim();
  const imageFileInput = document.getElementById("product-form-image");

  // Validaciones del lado del cliente antes de enviar
  let isValid = true;
  if (!name || name.length < 2 || name.length > 150) {
    document.getElementById("err-product-name").textContent = "El nombre debe tener entre 2 y 150 caracteres.";
    isValid = false;
  }
  if (!categoryId) {
    document.getElementById("err-product-category").textContent = "Selecciona una categoría válida.";
    isValid = false;
  }
  if (!brand || brand.length < 2 || brand.length > 150) {
    document.getElementById("err-product-brand").textContent = "La marca debe tener entre 2 y 150 caracteres.";
    isValid = false;
  }
  if (isNaN(priceVal) || priceVal <= 0) {
    document.getElementById("err-product-price").textContent = "El precio debe ser un número positivo mayor que 0.";
    isValid = false;
  }
  if (isNaN(stockVal) || stockVal < 0) {
    document.getElementById("err-product-stock").textContent = "El stock debe ser un entero de 0 o más.";
    isValid = false;
  }
  if (!unitOfMeasure || unitOfMeasure.length < 1 || unitOfMeasure.length > 20) {
    document.getElementById("err-product-unit").textContent = "La unidad de medida es requerida (máx 20 car.).";
    isValid = false;
  }
  if (!description || description.length < 2 || description.length > 500) {
    document.getElementById("err-product-desc").textContent = "La descripción debe tener entre 2 y 500 caracteres.";
    isValid = false;
  }

  if (!isValid) return;

  const saveBtn = document.getElementById("btn-save-product");
  const saveText = document.getElementById("btn-save-text");
  saveBtn.disabled = true;
  saveText.textContent = isEditing ? "Guardando..." : "Publicando producto...";
  state.isSubmitting = true;

  try {
    // Siempre usar user.id como ownerId para Storage (coincidir con auth.uid())
    const ownerId = state.user?.id;
    let uploadedUrls = [];
    let uploadErrors = [];

    // 1. Subir imágenes si se seleccionaron archivos (secuencial, con progreso)
    if (!isEditing && imageFileInput && imageFileInput.files.length > 0) {
      const files = Array.from(imageFileInput.files);
      saveText.textContent = `Subiendo 0 de ${files.length} imagen(es)...`;

      const result = await uploadMultipleProductImages(
        files,
        ownerId,
        (uploaded, total) => {
          saveText.textContent = `Subiendo ${uploaded} de ${total} imagen(es)...`;
        },
      );

      uploadedUrls = result.urls;
      uploadErrors = result.errors;

      if (uploadErrors.length > 0 && uploadedUrls.length === 0) {
        // Todas fallaron: abortar
        NotificationManager.error(
          `No se pudo subir ninguna imagen: ${uploadErrors[0].error}`,
        );
        saveBtn.disabled = false;
        saveText.textContent = "Publicar Producto";
        state.isSubmitting = false;
        return;
      }
    }

    // 2. Construir payload del producto
    const payload = {
      supplier_id: state.supplier.id,
      category_id: categoryId,
      name,
      brand,
      price: priceVal,
      currency,
      stock: stockVal,
      unit_of_measure: unitOfMeasure,
      model: model || undefined,
      description,
      image_url: uploadedUrls.length > 0 ? uploadedUrls[0] : undefined,
    };

    if (isEditing) {
      delete payload.supplier_id;
      delete payload.image_url;
      await homeApi.updateProduct(productId, payload);
      NotificationManager.success("Producto actualizado correctamente.");
    } else {
      // Crear producto (la primera imagen ya se asocia como primaria via image_url)
      const res = await homeApi.addProduct(payload);
      const newProduct = res?.data;

      // Si hay más imágenes adicionales seleccionadas, subirlas y vincularlas
      if (newProduct?.id && uploadedUrls.length > 1) {
        for (let i = 1; i < uploadedUrls.length; i++) {
          try {
            await homeApi.addProductImage(newProduct.id, {
              image_url: uploadedUrls[i],
              is_primary: false,
              display_order: i,
            });
          } catch (extraImgErr) {
            console.warn("[homeSupplier.js] Error asociando imagen secundaria:", extraImgErr);
          }
        }
      }

      // Notificar si alguna imagen secundaria falló
      if (uploadErrors.length > 0) {
        NotificationManager.success(
          `¡Producto publicado! ${uploadErrors.length} imagen(es) no se pudieron subir.`,
        );
      } else {
        NotificationManager.success("¡Producto publicado exitosamente!");
      }
    }

    closeModal("productModal");
    await loadProducts();
  } catch (err) {
    console.error("[homeSupplier.js] Error al guardar producto:", err);
    NotificationManager.error(err.message || "No se pudo guardar el producto.");
  } finally {
    saveBtn.disabled = false;
    saveText.textContent = isEditing ? "Guardar Cambios" : "Publicar Producto";
    state.isSubmitting = false;
  }
}

// ── IMAGES MANAGEMENT MODAL ──────────────────────────────────────────────────

async function openImagesModal(productId) {
  state.activeProductId = productId;
  state.selectedImageFiles = [];
  document.getElementById("images-product-id").value = productId;

  const form = document.getElementById("addImageForm");
  if (form) form.reset();

  const preview = document.getElementById("image-upload-preview");
  if (preview) {
    preview.style.display = "none";
    preview.innerHTML = "";
  }

  const btnAdd = document.getElementById("btn-add-image");
  if (btnAdd) btnAdd.disabled = true;

  openModal("imagesModal");
  await renderProductImagesList(productId);
}

function initImageFileInput() {
  const fileInput = document.getElementById("new-image-file");
  const preview = document.getElementById("image-upload-preview");
  const btnAdd = document.getElementById("btn-add-image");

  if (!fileInput) return;

  fileInput.addEventListener("change", () => {
    if (fileInput.files && fileInput.files.length > 0) {
      state.selectedImageFiles = Array.from(fileInput.files);

      if (preview) {
        preview.innerHTML = state.selectedImageFiles
          .map(
            (file) => `
            <div style="display:flex; align-items:center; gap:8px; background:#ffffff; padding:6px 10px; border-radius:6px; border:1px solid #e2e8f0; max-width:200px;">
              <img src="${URL.createObjectURL(file)}" alt="preview" style="width:36px;height:36px;object-fit:cover;border-radius:4px;flex-shrink:0;" />
              <span style="font-size:0.78rem; color:#334155; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(file.name)}</span>
            </div>
          `,
          )
          .join("");
        preview.style.display = "flex";
      }
      if (btnAdd) btnAdd.disabled = false;
    } else {
      state.selectedImageFiles = [];
      if (preview) {
        preview.style.display = "none";
        preview.innerHTML = "";
      }
      if (btnAdd) btnAdd.disabled = true;
    }
  });
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
  const files = state.selectedImageFiles;
  const isPrimaryChecked = document.getElementById("new-image-primary")?.checked ?? false;

  if (!files || files.length === 0 || !productId) {
    NotificationManager.error("Selecciona al menos una imagen antes de subir.");
    return;
  }

  const btn = document.getElementById("btn-add-image");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-inline"></span> Subiendo ${files.length} fotos...`;

  try {
    // Siempre usar user.id para Storage (coincidir con auth.uid())
    const ownerId = state.user?.id;

    btn.innerHTML = `<span class="spinner-inline"></span> Subiendo 0 de ${files.length}...`;

    // 1. Subir imágenes secuencialmente con progreso
    const { urls: publicUrls, errors: uploadErrors } = await uploadMultipleProductImages(
      files,
      ownerId,
      (uploaded, total) => {
        btn.innerHTML = `<span class="spinner-inline"></span> Subiendo ${uploaded} de ${total}...`;
      },
    );

    if (publicUrls.length === 0) {
      NotificationManager.error(
        `No se pudo subir ninguna imagen. ${uploadErrors[0]?.error || "Verifica el bucket de Supabase."}`,
      );
      return;
    }

    // 2. Asociar cada URL subida a la base de datos
    for (let i = 0; i < publicUrls.length; i++) {
      const url = publicUrls[i];
      const isPrimary = i === 0 && isPrimaryChecked;
      await homeApi.addProductImage(productId, {
        image_url: url,
        is_primary: isPrimary,
        display_order: i,
      });
    }

    const successMsg = uploadErrors.length > 0
      ? `${publicUrls.length} imagen(es) agregada(s). ${uploadErrors.length} fallaron.`
      : `¡${publicUrls.length} imagen(es) agregada(s) a la galería correctamente!`;
    NotificationManager.success(successMsg);

    // Resetear form y preview
    document.getElementById("addImageForm").reset();
    state.selectedImageFiles = [];
    const preview = document.getElementById("image-upload-preview");
    if (preview) {
      preview.style.display = "none";
      preview.innerHTML = "";
    }

    await renderProductImagesList(productId);
    await loadProducts();
  } catch (err) {
    console.error("[homeSupplier.js] Error al agregar imágenes:", err);
    NotificationManager.error(err.message || "No se pudieron agregar las imágenes.");
  } finally {
    btn.disabled = false;
    btn.textContent = "+ Agregar Imágenes";
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
  initImageFileInput();

  document.getElementById("btn-open-add-product")?.addEventListener("click", openAddProductModal);
  document.getElementById("productForm")?.addEventListener("submit", handleProductFormSubmit);
  document.getElementById("addImageForm")?.addEventListener("submit", handleAddImageSubmit);
  document.getElementById("btn-confirm-delete")?.addEventListener("click", handleConfirmDelete);

  document.getElementById("catalog-search-input")?.addEventListener("input", applyFilters);
  document.getElementById("filter-category-select")?.addEventListener("change", applyFilters);
  document.getElementById("filter-status-select")?.addEventListener("change", applyFilters);
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
