/**
 * @file categories.js
 * @description CRUD completo de categorías para el panel administrativo.
 */

import {
  requireAdminAuth,
  fillSidebarUser,
  initSidebarToggle,
  admToast,
} from "./adminAuth.js";
import { categoriesAdminApi } from "./adminApi.js";

let adminUser;
try {
  adminUser = requireAdminAuth();
} catch {
  /* redirect */
}
fillSidebarUser(adminUser);
initSidebarToggle();

const state = {
  categories: [],
  page: 1,
  limit: 12,
  total: 0,
  totalPages: 1,
  search: "",
  editingId: null,
  deletingId: null,
  deletingName: "",
};

const tbody = document.getElementById("categoriesTableBody");
const tableTotal = document.getElementById("tableTotal");
const searchInput = document.getElementById("searchInput");
const pagination = document.getElementById("pagination");
const paginationInfo = document.getElementById("paginationInfo");
const pagControls = document.getElementById("paginationControls");

const categoryModal = document.getElementById("categoryModal");
const modalTitle = document.getElementById("categoryModalTitle");
const catName = document.getElementById("catName");
const catIconUrl = document.getElementById("catIconUrl");
const catStatus = document.getElementById("catStatus");
const catNameError = document.getElementById("catNameError");
const categoryFormErr = document.getElementById("categoryFormError");
const saveCategoryBtn = document.getElementById("saveCategoryBtn");
const saveBtnText = document.getElementById("saveCategoryBtnText");

const deleteModal = document.getElementById("deleteModal");
const deleteCategoryName = document.getElementById("deleteCategoryName");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const deleteBtnText = document.getElementById("deleteBtnText");

function fmtDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("es", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function badgeHtml(status) {
  const cls = status === "active" ? "adm-badge--active" : "adm-badge--inactive";
  const lbl = status === "active" ? "Activa" : "Inactiva";
  return `<span class="adm-badge ${cls}">${lbl}</span>`;
}

async function loadCategories() {
  tbody.innerHTML = `<tr><td colspan="5"><div class="adm-empty" style="padding:40px"><div class="adm-spinner" style="width:28px;height:28px"></div></div></td></tr>`;

  try {
    const res = await categoriesAdminApi.getAll({
      page: state.page,
      limit: state.limit,
      name: state.search || undefined,
    });
    const data = res.data ?? [];
    const meta = res.meta ?? {};
    state.categories = data;
    state.total = meta.total ?? data.length;
    state.totalPages = meta.totalPages ?? 1;

    tableTotal.textContent = `${state.total} categorías`;
    renderTable(data);
    renderPagination();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="adm-empty"><p class="adm-empty__title">Error al cargar categorías</p><p class="adm-empty__text">${err.message}</p></div></td></tr>`;
  }
}

function renderTable(data) {
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="adm-empty"><div class="adm-empty__icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h7"/></svg></div><p class="adm-empty__title">Sin categorías</p><p class="adm-empty__text">Crea la primera categoría del sistema.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = data
    .map(
      (cat) => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          ${
            cat.icon_url
              ? `<img src="${cat.icon_url}" alt="" width="28" height="28" style="border-radius:6px;object-fit:contain;background:var(--adm-bg-elevated);padding:2px"/>`
              : `<div style="width:28px;height:28px;border-radius:6px;background:var(--adm-bg-elevated);display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--adm-text-muted)" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h7"/></svg></div>`
          }
          <span style="font-weight:600">${cat.name}</span>
        </div>
      </td>
      <td style="color:var(--adm-text-muted)">${cat.parent_id ? cat.parent_id.slice(0, 8) + "…" : "—"}</td>
      <td>${badgeHtml(cat.status)}</td>
      <td style="color:var(--adm-text-muted)">${fmtDate(cat.created_at)}</td>
      <td>
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px">
          <button class="adm-btn adm-btn--icon adm-btn--sm" data-edit="${cat.id}" title="Editar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="adm-btn adm-btn--icon adm-btn--sm" data-delete="${cat.id}" data-name="${cat.name}" title="Eliminar" style="color:var(--adm-danger)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `,
    )
    .join("");

  tbody.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => openEditModal(btn.dataset.edit));
  });

  tbody.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () =>
      openDeleteModal(btn.dataset.delete, btn.dataset.name),
    );
  });
}

function renderPagination() {
  if (state.totalPages <= 1) {
    pagination.style.display = "none";
    return;
  }
  pagination.style.display = "flex";
  const start = (state.page - 1) * state.limit + 1;
  const end = Math.min(state.page * state.limit, state.total);
  paginationInfo.textContent = `Mostrando ${start}–${end} de ${state.total}`;

  pagControls.innerHTML = "";
  const prevBtn = document.createElement("button");
  prevBtn.className = "adm-page-btn";
  prevBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>`;
  prevBtn.disabled = state.page === 1;
  prevBtn.addEventListener("click", () => {
    state.page--;
    loadCategories();
  });
  pagControls.appendChild(prevBtn);

  const range = 5;
  const startPage = Math.max(1, state.page - Math.floor(range / 2));
  const endPage = Math.min(state.totalPages, startPage + range - 1);
  for (let p = startPage; p <= endPage; p++) {
    const pb = document.createElement("button");
    pb.className = `adm-page-btn${p === state.page ? " active" : ""}`;
    pb.textContent = p;
    pb.addEventListener("click", () => {
      state.page = p;
      loadCategories();
    });
    pagControls.appendChild(pb);
  }

  const nextBtn = document.createElement("button");
  nextBtn.className = "adm-page-btn";
  nextBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>`;
  nextBtn.disabled = state.page === state.totalPages;
  nextBtn.addEventListener("click", () => {
    state.page++;
    loadCategories();
  });
  pagControls.appendChild(nextBtn);
}

function openCreateModal() {
  state.editingId = null;
  modalTitle.textContent = "Nueva categoría";
  catName.value = "";
  catIconUrl.value = "";
  catStatus.value = "active";
  catNameError.textContent = "";
  categoryFormErr.style.display = "none";
  saveBtnText.textContent = "Crear categoría";
  categoryModal.style.display = "flex";
  catName.focus();
}

async function openEditModal(id) {
  state.editingId = id;
  modalTitle.textContent = "Editar categoría";
  saveBtnText.textContent = "Guardar cambios";
  categoryFormErr.style.display = "none";
  catNameError.textContent = "";
  categoryModal.style.display = "flex";

  try {
    const res = await categoriesAdminApi.getById(id);
    const cat = res.data ?? res;
    catName.value = cat.name ?? "";
    catIconUrl.value = cat.icon_url ?? "";
    catStatus.value = cat.status ?? "active";
    catName.focus();
  } catch (err) {
    closeCategoryModal();
    admToast.error("No se pudo cargar la categoría: " + err.message);
  }
}

function closeCategoryModal() {
  categoryModal.style.display = "none";
  state.editingId = null;
}

document
  .getElementById("openCreateModal")
  ?.addEventListener("click", openCreateModal);
document
  .getElementById("closeCategoryModal")
  ?.addEventListener("click", closeCategoryModal);
document
  .getElementById("cancelCategoryModal")
  ?.addEventListener("click", closeCategoryModal);
categoryModal?.addEventListener("click", (e) => {
  if (e.target === categoryModal) closeCategoryModal();
});

saveCategoryBtn?.addEventListener("click", async () => {
  const name = catName.value.trim();
  const iconUrl = catIconUrl.value.trim() || null;
  const status = catStatus.value;

  if (!name) {
    catNameError.textContent = "El nombre es obligatorio.";
    catNameError.classList.add("show");
    return;
  }
  catNameError.classList.remove("show");
  categoryFormErr.style.display = "none";

  saveCategoryBtn.disabled = true;
  saveBtnText.textContent = "Guardando...";

  try {
    if (state.editingId) {
      await categoriesAdminApi.update(state.editingId, {
        name,
        icon_url: iconUrl,
        status,
      });
      admToast.success("Categoría actualizada correctamente.");
    } else {
      await categoriesAdminApi.create({ name, icon_url: iconUrl });
      admToast.success("Categoría creada correctamente.");
    }
    closeCategoryModal();
    state.page = 1;
    await loadCategories();
  } catch (err) {
    categoryFormErr.textContent =
      err.message || "Error al guardar la categoría.";
    categoryFormErr.style.display = "block";
  } finally {
    saveCategoryBtn.disabled = false;
    saveBtnText.textContent = state.editingId
      ? "Guardar cambios"
      : "Crear categoría";
  }
});

function openDeleteModal(id, name) {
  state.deletingId = id;
  state.deletingName = name;
  deleteCategoryName.textContent = name;
  deleteModal.style.display = "flex";
}

function closeDeleteModal() {
  deleteModal.style.display = "none";
  state.deletingId = null;
}

document
  .getElementById("closeDeleteModal")
  ?.addEventListener("click", closeDeleteModal);
document
  .getElementById("cancelDeleteBtn")
  ?.addEventListener("click", closeDeleteModal);
deleteModal?.addEventListener("click", (e) => {
  if (e.target === deleteModal) closeDeleteModal();
});

confirmDeleteBtn?.addEventListener("click", async () => {
  if (!state.deletingId) return;
  confirmDeleteBtn.disabled = true;
  deleteBtnText.textContent = "Eliminando...";

  try {
    await categoriesAdminApi.delete(state.deletingId);
    admToast.success(`Categoría "${state.deletingName}" eliminada.`);
    closeDeleteModal();
    await loadCategories();
  } catch (err) {
    admToast.error(err.message || "No se pudo eliminar la categoría.");
    closeDeleteModal();
  } finally {
    confirmDeleteBtn.disabled = false;
    deleteBtnText.textContent = "Eliminar";
  }
});

let searchTimeout = null;
searchInput?.addEventListener("input", () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    state.search = searchInput.value.trim();
    state.page = 1;
    loadCategories();
  }, 400);
});

document.addEventListener("DOMContentLoaded", loadCategories);
