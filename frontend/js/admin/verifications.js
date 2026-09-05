/**
 * @file verifications.js
 * @description Gestión de solicitudes de verificación de proveedores.
 */

import {
  requireAdminAuth,
  fillSidebarUser,
  initSidebarToggle,
  admToast,
} from "./adminAuth.js";
import { verificationsApi } from "./adminApi.js";

let adminUser;
try {
  adminUser = requireAdminAuth();
} catch {}
fillSidebarUser(adminUser);
initSidebarToggle();

const state = {
  page: 1,
  limit: 12,
  total: 0,
  totalPages: 1,
  status: "pending",
  search: "",
  viewingId: null,
};

const tbody = document.getElementById("verificationsTableBody");
const tableTotal = document.getElementById("tableTotal");
const searchInput = document.getElementById("searchInput");
const pagination = document.getElementById("pagination");
const paginationInfo = document.getElementById("paginationInfo");
const pagControls = document.getElementById("paginationControls");
const detailModal = document.getElementById("detailModal");
const detailBody = document.getElementById("detailModalBody");
const detailFooter = document.getElementById("detailModalFooter");
const detailTitle = document.getElementById("detailModalTitle");

function fmtDate(d) {
  return d
    ? new Date(d).toLocaleDateString("es", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
}

const BADGE = {
  pending: `<span class="adm-badge adm-badge--pending">Pendiente</span>`,
  verified: `<span class="adm-badge adm-badge--verified">Verificada</span>`,
  rejected: `<span class="adm-badge adm-badge--rejected">Rechazada</span>`,
};

async function loadVerifications() {
  tbody.innerHTML = `<tr><td colspan="6"><div class="adm-empty" style="padding:40px"><div class="adm-spinner" style="width:28px;height:28px"></div></div></td></tr>`;
  try {
    const res = await verificationsApi.getAll({
      page: state.page,
      limit: state.limit,
      status: state.status,
      search: state.search || undefined,
    });
    const data = res.data ?? [];
    const pag = res.pagination ?? {};
    state.total = pag.totalItems ?? data.length;
    state.totalPages = pag.totalPages ?? 1;
    tableTotal.textContent = `${state.total} solicitudes`;
    renderTable(data);
    renderPagination();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="adm-empty"><p class="adm-empty__title">Error al cargar</p><p class="adm-empty__text">${err.message}</p></div></td></tr>`;
  }
}

function renderTable(data) {
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="adm-empty"><div class="adm-empty__icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div><p class="adm-empty__title">Sin solicitudes</p><p class="adm-empty__text">No hay solicitudes con el filtro seleccionado.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = data
    .map(
      (c) => `
    <tr>
      <td>
        <div class="adm-user-cell">
          ${c.logo_url ? `<img class="adm-avatar--img" src="${c.logo_url}" alt="${c.name}" width="34" height="34" style="border-radius:8px;object-fit:contain"/>` : `<div class="adm-avatar" style="border-radius:8px;width:34px;height:34px;font-size:13px">${c.name.slice(0, 2).toUpperCase()}</div>`}
          <div class="adm-user-cell__info">
            <div class="adm-user-cell__name">${c.name}</div>
            <div class="adm-user-cell__email">${c.city ?? ""} ${c.state_province ? `· ${c.state_province}` : ""}</div>
          </div>
        </div>
      </td>
      <td>
        <div style="font-size:13px;font-weight:500">${c.owner_first_name} ${c.owner_last_name}</div>
        <div style="font-size:12px;color:var(--adm-text-muted)">${c.owner_email}</div>
      </td>
      <td style="color:var(--adm-text-muted);font-family:monospace;font-size:13px">${c.tax_id ?? "—"}</td>
      <td>${BADGE[c.verification_status] ?? `<span class="adm-badge">${c.verification_status}</span>`}</td>
      <td style="color:var(--adm-text-muted)">${fmtDate(c.created_at)}</td>
      <td>
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px">
          <button class="adm-btn adm-btn--secondary adm-btn--sm" data-view="${c.id}">Ver detalle</button>
          ${
            state.status === "pending"
              ? `
            <button class="adm-btn adm-btn--success adm-btn--sm" data-approve="${c.id}" data-name="${c.name}">Aprobar</button>
            <button class="adm-btn adm-btn--danger adm-btn--sm" data-reject="${c.id}" data-name="${c.name}">Rechazar</button>
          `
              : ""
          }
        </div>
      </td>
    </tr>
  `,
    )
    .join("");

  tbody
    .querySelectorAll("[data-view]")
    .forEach((btn) =>
      btn.addEventListener("click", () => openDetail(btn.dataset.view)),
    );
  tbody
    .querySelectorAll("[data-approve]")
    .forEach((btn) =>
      btn.addEventListener("click", () =>
        handleApprove(btn.dataset.approve, btn.dataset.name, btn),
      ),
    );
  tbody
    .querySelectorAll("[data-reject]")
    .forEach((btn) =>
      btn.addEventListener("click", () =>
        handleReject(btn.dataset.reject, btn.dataset.name, btn),
      ),
    );
}

async function handleApprove(id, name, btn) {
  btn.disabled = true;
  btn.textContent = "Aprobando...";
  try {
    await verificationsApi.approve(id);
    admToast.success(`Empresa "${name}" aprobada como proveedor verificado.`);
    await loadVerifications();
  } catch (err) {
    admToast.error(err.message || "Error al aprobar.");
    btn.disabled = false;
    btn.textContent = "Aprobar";
  }
}

async function handleReject(id, name, btn) {
  if (!confirm(`¿Rechazar la solicitud de "${name}"?`)) return;
  btn.disabled = true;
  btn.textContent = "Rechazando...";
  try {
    await verificationsApi.reject(id);
    admToast.warning(`Solicitud de "${name}" rechazada.`);
    await loadVerifications();
  } catch (err) {
    admToast.error(err.message || "Error al rechazar.");
    btn.disabled = false;
    btn.textContent = "Rechazar";
  }
}

async function openDetail(id) {
  state.viewingId = id;
  detailTitle.textContent = "Detalle de empresa";
  detailBody.innerHTML = `<div style="display:flex;justify-content:center;padding:40px"><div class="adm-spinner" style="width:32px;height:32px"></div></div>`;
  detailFooter.innerHTML = "";
  detailModal.style.display = "flex";

  try {
    const res = await verificationsApi.getDetail(id);
    const c = res.data ?? res;
    detailTitle.textContent = c.name;

    detailBody.innerHTML = `
      <div class="adm-detail-card">
        <div class="adm-detail-card__title">Información de la empresa</div>
        <div class="adm-detail-grid">
          <div class="adm-detail-item"><div class="adm-detail-item__label">Nombre</div><div class="adm-detail-item__value">${c.name ?? "—"}</div></div>
          <div class="adm-detail-item"><div class="adm-detail-item__label">RUC / Tax ID</div><div class="adm-detail-item__value" style="font-family:monospace">${c.tax_id ?? "—"}</div></div>
          <div class="adm-detail-item"><div class="adm-detail-item__label">Email</div><div class="adm-detail-item__value">${c.email ?? "—"}</div></div>
          <div class="adm-detail-item"><div class="adm-detail-item__label">Teléfono</div><div class="adm-detail-item__value">${c.phone ?? "—"}</div></div>
          <div class="adm-detail-item"><div class="adm-detail-item__label">Ciudad</div><div class="adm-detail-item__value">${c.city ?? "—"}</div></div>
          <div class="adm-detail-item"><div class="adm-detail-item__label">Departamento</div><div class="adm-detail-item__value">${c.state_province ?? "—"}</div></div>
          <div class="adm-detail-item" style="grid-column:1/-1"><div class="adm-detail-item__label">Dirección</div><div class="adm-detail-item__value">${c.address ?? "—"}</div></div>
          <div class="adm-detail-item" style="grid-column:1/-1"><div class="adm-detail-item__label">Descripción</div><div class="adm-detail-item__value" style="line-height:1.6">${c.description ?? "—"}</div></div>
        </div>
      </div>
      <div class="adm-detail-card">
        <div class="adm-detail-card__title">Propietario</div>
        <div class="adm-detail-grid">
          <div class="adm-detail-item"><div class="adm-detail-item__label">Nombre</div><div class="adm-detail-item__value">${c.owner_first_name} ${c.owner_last_name}</div></div>
          <div class="adm-detail-item"><div class="adm-detail-item__label">Email</div><div class="adm-detail-item__value">${c.owner_email ?? "—"}</div></div>
          <div class="adm-detail-item"><div class="adm-detail-item__label">Teléfono</div><div class="adm-detail-item__value">${c.owner_phone ?? "—"}</div></div>
        </div>
      </div>
    `;

    if (c.verification_status === "pending") {
      detailFooter.innerHTML = `
        <button class="adm-btn adm-btn--secondary" id="modalCloseBtn">Cerrar</button>
        <button class="adm-btn adm-btn--danger" id="modalRejectBtn">Rechazar</button>
        <button class="adm-btn adm-btn--success" id="modalApproveBtn">Aprobar verificación</button>
      `;
      document
        .getElementById("modalApproveBtn")
        .addEventListener("click", async () => {
          detailModal.style.display = "none";
          await handleApprove(id, c.name, { disabled: false, textContent: "" });
        });
      document
        .getElementById("modalRejectBtn")
        .addEventListener("click", async () => {
          detailModal.style.display = "none";
          await handleReject(id, c.name, { disabled: false, textContent: "" });
        });
      document.getElementById("modalCloseBtn").addEventListener("click", () => {
        detailModal.style.display = "none";
      });
    } else {
      detailFooter.innerHTML = `<button class="adm-btn adm-btn--secondary" id="modalCloseBtn2">Cerrar</button>`;
      document
        .getElementById("modalCloseBtn2")
        .addEventListener("click", () => {
          detailModal.style.display = "none";
        });
    }
  } catch (err) {
    detailBody.innerHTML = `<div class="adm-alert adm-alert--danger"><div class="adm-alert__text">Error: ${err.message}</div></div>`;
  }
}

document.getElementById("closeDetailModal")?.addEventListener("click", () => {
  detailModal.style.display = "none";
});
detailModal?.addEventListener("click", (e) => {
  if (e.target === detailModal) detailModal.style.display = "none";
});

function renderPagination() {
  if (state.totalPages <= 1) {
    pagination.style.display = "none";
    return;
  }
  pagination.style.display = "flex";
  const start = (state.page - 1) * state.limit + 1;
  const end = Math.min(state.page * state.limit, state.total);
  paginationInfo.textContent = `${start}–${end} de ${state.total}`;
  pagControls.innerHTML = "";
  const prev = document.createElement("button");
  prev.className = "adm-page-btn";
  prev.innerHTML = "‹";
  prev.disabled = state.page === 1;
  prev.addEventListener("click", () => {
    state.page--;
    loadVerifications();
  });
  pagControls.appendChild(prev);
  for (let p = 1; p <= state.totalPages; p++) {
    const pb = document.createElement("button");
    pb.className = `adm-page-btn${p === state.page ? " active" : ""}`;
    pb.textContent = p;
    pb.addEventListener("click", () => {
      state.page = p;
      loadVerifications();
    });
    pagControls.appendChild(pb);
  }
  const next = document.createElement("button");
  next.className = "adm-page-btn";
  next.innerHTML = "›";
  next.disabled = state.page === state.totalPages;
  next.addEventListener("click", () => {
    state.page++;
    loadVerifications();
  });
  pagControls.appendChild(next);
}

function setActiveFilter(newStatus) {
  state.status = newStatus;
  state.page = 1;
  document.querySelectorAll("[data-filter]").forEach((btn) => {
    btn.className =
      btn.dataset.filter === newStatus
        ? "adm-btn adm-btn--primary adm-btn--sm"
        : "adm-btn adm-btn--secondary adm-btn--sm";
  });
  loadVerifications();
}

document
  .querySelectorAll("[data-filter]")
  .forEach((btn) =>
    btn.addEventListener("click", () => setActiveFilter(btn.dataset.filter)),
  );

let searchTimeout = null;
searchInput?.addEventListener("input", () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    state.search = searchInput.value.trim();
    state.page = 1;
    loadVerifications();
  }, 400);
});

document.addEventListener("DOMContentLoaded", loadVerifications);
