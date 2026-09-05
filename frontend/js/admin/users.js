/**
 * @file users.js
 * @description Modulo de gestión de usuarios para el panel administrativo.
 */

import {
  requireAdminAuth,
  fillSidebarUser,
  initSidebarToggle,
  admToast,
} from "./adminAuth.js";
import { usersAdminApi } from "./adminApi.js";

let adminUser;
try {
  adminUser = requireAdminAuth();
} catch {}
fillSidebarUser(adminUser);
initSidebarToggle();

const state = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 1,
  status: "",
  search: "",
  editingUserId: null,
  editingUserName: "",
  currentStatus: "",
};

const tbody = document.getElementById("usersTableBody");
const tableTotal = document.getElementById("tableTotal");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const pagination = document.getElementById("pagination");
const paginationInfo = document.getElementById("paginationInfo");
const pagControls = document.getElementById("paginationControls");

const statusModal = document.getElementById("statusModal");
const statusModalName = document.getElementById("statusModalUserName");
const newStatusSelect = document.getElementById("newStatusSelect");
const statusModalError = document.getElementById("statusModalError");
const confirmStatusBtn = document.getElementById("confirmStatusBtn");
const confirmBtnText = document.getElementById("confirmStatusBtnText");

function fmtDate(d) {
  return d
    ? new Date(d).toLocaleDateString("es", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
}

function getInitials(first, last, email) {
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first) return first.slice(0, 2).toUpperCase();
  return (email || "US").slice(0, 2).toUpperCase();
}

function getStatusBadge(status) {
  const map = {
    active: `<span class="adm-badge adm-badge--active">Activo</span>`,
    inactive: `<span class="adm-badge adm-badge--inactive">Inactivo</span>`,
    suspended: `<span class="adm-badge adm-badge--suspended">Suspendido</span>`,
    pending: `<span class="adm-badge adm-badge--pending">Pendiente</span>`,
  };
  return map[status] || `<span class="adm-badge">${status}</span>`;
}

function getRoleBadge(roleName) {
  const name = (roleName || "").toLowerCase();
  if (name === "admin")
    return `<span class="adm-badge adm-badge--admin">Admin</span>`;
  return `<span class="adm-badge adm-badge--user">${roleName || "Usuario"}</span>`;
}

async function loadUsers() {
  tbody.innerHTML = `<tr><td colspan="6"><div class="adm-empty" style="padding:40px"><div class="adm-spinner" style="width:28px;height:28px"></div></div></td></tr>`;
  try {
    const res = await usersAdminApi.getAll({
      page: state.page,
      limit: state.limit,
      status: state.status || undefined,
      search: state.search || undefined,
    });
    const data = res.data ?? [];
    const pag = res.pagination ?? {};

    state.total = pag.totalItems ?? data.length;
    state.totalPages = pag.totalPages ?? 1;

    tableTotal.textContent = `${state.total} usuarios`;
    renderTable(data);
    renderPagination();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="adm-empty"><p class="adm-empty__title">Error al cargar usuarios</p><p class="adm-empty__text">${err.message}</p></div></td></tr>`;
  }
}

function renderTable(data) {
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="adm-empty"><div class="adm-empty__icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div><p class="adm-empty__title">Sin usuarios</p><p class="adm-empty__text">No se encontraron usuarios con los criterios de búsqueda.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = data
    .map((u) => {
      const initials = getInitials(u.first_name, u.last_name, u.email);
      const fullName =
        u.first_name && u.last_name
          ? `${u.first_name} ${u.last_name}`
          : u.email.split("@")[0];
      const isSelf = u.id === adminUser.id;

      return `
      <tr>
        <td>
          <div class="adm-user-cell">
            ${
              u.profile_picture_url
                ? `<img class="adm-avatar--img" src="${u.profile_picture_url}" alt="${fullName}"/>`
                : `<div class="adm-avatar">${initials}</div>`
            }
            <div class="adm-user-cell__info">
              <div class="adm-user-cell__name">${fullName} ${isSelf ? `<span style="font-size:11px;color:var(--adm-accent);font-weight:700">(Tú)</span>` : ""}</div>
              <div class="adm-user-cell__email">${u.email}</div>
            </div>
          </div>
        </td>
        <td>${getRoleBadge(u.role_name)}</td>
        <td>${getStatusBadge(u.status)}</td>
        <td style="color:var(--adm-text-muted);font-size:13px">${fmtDate(u.last_login_at)}</td>
        <td style="color:var(--adm-text-muted);font-size:13px">${fmtDate(u.created_at)}</td>
        <td>
          <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px">
            <button class="adm-btn adm-btn--secondary adm-btn--sm" data-change-status="${u.id}" data-name="${fullName}" data-status="${u.status}" ${isSelf ? "disabled title='No puedes cambiar tu propio estado'" : ""}>
              Cambiar estado
            </button>
          </div>
        </td>
      </tr>
    `;
    })
    .join("");

  tbody.querySelectorAll("[data-change-status]").forEach((btn) => {
    if (btn.disabled) return;
    btn.addEventListener("click", () => {
      openStatusModal(
        btn.dataset.changeStatus,
        btn.dataset.name,
        btn.dataset.status,
      );
    });
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
  prevBtn.innerHTML = "‹";
  prevBtn.disabled = state.page === 1;
  prevBtn.addEventListener("click", () => {
    state.page--;
    loadUsers();
  });
  pagControls.appendChild(prevBtn);

  for (let p = 1; p <= state.totalPages; p++) {
    const pb = document.createElement("button");
    pb.className = `adm-page-btn${p === state.page ? " active" : ""}`;
    pb.textContent = p;
    pb.addEventListener("click", () => {
      state.page = p;
      loadUsers();
    });
    pagControls.appendChild(pb);
  }

  const nextBtn = document.createElement("button");
  nextBtn.className = "adm-page-btn";
  nextBtn.innerHTML = "›";
  nextBtn.disabled = state.page === state.totalPages;
  nextBtn.addEventListener("click", () => {
    state.page++;
    loadUsers();
  });
  pagControls.appendChild(nextBtn);
}

function openStatusModal(userId, userName, currentStatus) {
  state.editingUserId = userId;
  state.editingUserName = userName;
  state.currentStatus = currentStatus;

  statusModalName.textContent = userName;
  newStatusSelect.value = currentStatus;
  statusModalError.style.display = "none";
  statusModal.style.display = "flex";
}

function closeStatusModal() {
  statusModal.style.display = "none";
  state.editingUserId = null;
}

document
  .getElementById("closeStatusModal")
  ?.addEventListener("click", closeStatusModal);
document
  .getElementById("cancelStatusModal")
  ?.addEventListener("click", closeStatusModal);
statusModal?.addEventListener("click", (e) => {
  if (e.target === statusModal) closeStatusModal();
});

confirmStatusBtn?.addEventListener("click", async () => {
  if (!state.editingUserId) return;
  const status = newStatusSelect.value;
  if (status === state.currentStatus) {
    closeStatusModal();
    return;
  }

  confirmStatusBtn.disabled = true;
  confirmBtnText.textContent = "Actualizando...";
  statusModalError.style.display = "none";

  try {
    await usersAdminApi.changeStatus(state.editingUserId, status);
    admToast.success(
      `Estado de "${state.editingUserName}" cambiado a ${status}.`,
    );
    closeStatusModal();
    await loadUsers();
  } catch (err) {
    statusModalError.textContent = err.message || "Error al actualizar estado.";
    statusModalError.style.display = "block";
  } finally {
    confirmStatusBtn.disabled = false;
    confirmBtnText.textContent = "Confirmar";
  }
});

let searchTimeout = null;
searchInput?.addEventListener("input", () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    state.search = searchInput.value.trim();
    state.page = 1;
    loadUsers();
  }, 400);
});

statusFilter?.addEventListener("change", () => {
  state.status = statusFilter.value;
  state.page = 1;
  loadUsers();
});

document.addEventListener("DOMContentLoaded", loadUsers);
