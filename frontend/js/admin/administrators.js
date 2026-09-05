/**
 * @file administrators.js
 * @description Gestión de administradores del sistema. Permite listar y crear nuevas cuentas de administrador.
 */

import {
  requireAdminAuth,
  fillSidebarUser,
  initSidebarToggle,
  admToast,
} from "./adminAuth.js";
import { administratorsApi } from "./adminApi.js";

let adminUser;
try {
  adminUser = requireAdminAuth();
} catch {
  /* redirect */
}
fillSidebarUser(adminUser);
initSidebarToggle();

const state = { page: 1, limit: 10, total: 0, totalPages: 1 };

const tbody = document.getElementById("adminsTableBody");
const tableTotal = document.getElementById("tableTotal");
const pagination = document.getElementById("pagination");
const paginationInfo = document.getElementById("paginationInfo");
const pagControls = document.getElementById("paginationControls");

const createAdminModal = document.getElementById("createAdminModal");
const openCreateModalBtn = document.getElementById("openCreateAdminModal");
const closeCreateModalBtn = document.getElementById("closeCreateAdminModal");
const cancelCreateModal = document.getElementById("cancelCreateAdminModal");
const saveAdminBtn = document.getElementById("saveAdminBtn");
const saveAdminBtnText = document.getElementById("saveAdminBtnText");
const createFormErr = document.getElementById("createAdminFormError");

const inputFirstName = document.getElementById("adminFirstName");
const inputLastName = document.getElementById("adminLastName");
const inputEmail = document.getElementById("newAdminEmail");
const inputPhone = document.getElementById("adminPhone");
const inputPassword = document.getElementById("newAdminPassword");

function fmtDate(d) {
  return d
    ? new Date(d).toLocaleDateString("es", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
}

function getInitials(first, last, email) {
  if (first && last) return `${first[0]}${last[0]}`.toUpperCase();
  if (first) return first.slice(0, 2).toUpperCase();
  return (email || "AD").slice(0, 2).toUpperCase();
}

async function loadAdministrators() {
  tbody.innerHTML = `<tr><td colspan="5"><div class="adm-empty" style="padding:40px"><div class="adm-spinner" style="width:28px;height:28px"></div></div></td></tr>`;
  try {
    const res = await administratorsApi.getAll({
      page: state.page,
      limit: state.limit,
    });
    const data = res.data ?? [];
    const pag = res.pagination ?? {};

    state.total = pag.totalItems ?? data.length;
    state.totalPages = pag.totalPages ?? 1;

    tableTotal.textContent = `${state.total} cuentas administrativas`;
    renderTable(data);
    renderPagination();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="adm-empty"><p class="adm-empty__title">Error al cargar administradores</p><p class="adm-empty__text">${err.message}</p></div></td></tr>`;
  }
}

function renderTable(data) {
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="adm-empty"><p class="adm-empty__title">No hay administradores registrados</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = data
    .map((admin) => {
      const initials = getInitials(
        admin.first_name,
        admin.last_name,
        admin.email,
      );
      const fullName =
        admin.first_name && admin.last_name
          ? `${admin.first_name} ${admin.last_name}`
          : admin.email.split("@")[0];
      const isSelf = admin.id === adminUser.id;

      return `
      <tr>
        <td>
          <div class="adm-user-cell">
            ${
              admin.profile_picture_url
                ? `<img class="adm-avatar--img" src="${admin.profile_picture_url}" alt="${fullName}"/>`
                : `<div class="adm-avatar" style="background:var(--adm-accent)">${initials}</div>`
            }
            <div class="adm-user-cell__info">
              <div class="adm-user-cell__name">${fullName} ${isSelf ? `<span style="font-size:11px;color:var(--adm-accent);font-weight:700">(Tú)</span>` : ""}</div>
              <div class="adm-user-cell__email">${admin.email}</div>
            </div>
          </div>
        </td>
        <td style="color:var(--adm-text-muted)">${admin.phone || "—"}</td>
        <td><span class="adm-badge adm-badge--active">Activo</span></td>
        <td style="color:var(--adm-text-muted);font-size:13px">${fmtDate(admin.last_login_at)}</td>
        <td style="color:var(--adm-text-muted);font-size:13px">${fmtDate(admin.created_at)}</td>
      </tr>
    `;
    })
    .join("");
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
    loadAdministrators();
  });
  pagControls.appendChild(prevBtn);

  for (let p = 1; p <= state.totalPages; p++) {
    const pb = document.createElement("button");
    pb.className = `adm-page-btn${p === state.page ? " active" : ""}`;
    pb.textContent = p;
    pb.addEventListener("click", () => {
      state.page = p;
      loadAdministrators();
    });
    pagControls.appendChild(pb);
  }

  const nextBtn = document.createElement("button");
  nextBtn.className = "adm-page-btn";
  nextBtn.innerHTML = "›";
  nextBtn.disabled = state.page === state.totalPages;
  nextBtn.addEventListener("click", () => {
    state.page++;
    loadAdministrators();
  });
  pagControls.appendChild(nextBtn);
}
function openCreateModal() {
  inputFirstName.value = "";
  inputLastName.value = "";
  inputEmail.value = "";
  inputPhone.value = "";
  inputPassword.value = "";
  createFormErr.style.display = "none";
  createAdminModal.style.display = "flex";
  inputFirstName.focus();
}

function closeCreateModal() {
  createAdminModal.style.display = "none";
}

openCreateModalBtn?.addEventListener("click", openCreateModal);
closeCreateModalBtn?.addEventListener("click", closeCreateModal);
cancelCreateModal?.addEventListener("click", closeCreateModal);
createAdminModal?.addEventListener("click", (e) => {
  if (e.target === createAdminModal) closeCreateModal();
});

saveAdminBtn?.addEventListener("click", async (e) => {
  e.preventDefault();

  const first_name = inputFirstName.value.trim();
  const last_name = inputLastName.value.trim();
  const email = inputEmail.value.trim();
  const phone = inputPhone.value.trim() || null;
  const password = inputPassword.value;

  if (!first_name || !last_name || !email || !password) {
    createFormErr.textContent =
      "Por favor completa todos los campos requeridos (*).";
    createFormErr.style.display = "block";
    return;
  }

  if (
    password.length < 8 ||
    !/[A-Z]/.test(password) ||
    !/[0-9]/.test(password)
  ) {
    createFormErr.textContent =
      "La contraseña debe tener al menos 8 caracteres, una mayúscula y un número.";
    createFormErr.style.display = "block";
    return;
  }

  saveAdminBtn.disabled = true;
  saveAdminBtnText.textContent = "Creando...";
  createFormErr.style.display = "none";

  try {
    await administratorsApi.create({
      first_name,
      last_name,
      email,
      phone,
      password,
    });

    admToast.success(
      `Administrador ${first_name} ${last_name} creado exitosamente.`,
    );
    closeCreateModal();
    state.page = 1;
    await loadAdministrators();
  } catch (err) {
    createFormErr.textContent =
      err.message || "Error al crear la cuenta de administrador.";
    createFormErr.style.display = "block";
  } finally {
    saveAdminBtn.disabled = false;
    saveAdminBtnText.textContent = "Crear Administrador";
  }
});

document.addEventListener("DOMContentLoaded", loadAdministrators);
