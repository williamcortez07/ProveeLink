/**
 * @file verificationRequests.js
 * @description Gestión de solicitudes del nuevo sistema de verificación con suscripción.
 * Conecta con: GET/PATCH /api/v1/verification/admin/requests
 */

import {
  requireAdminAuth,
  fillSidebarUser,
  initSidebarToggle,
  admToast,
} from "./adminAuth.js";
import { verRequestsApi } from "./adminApi.js";

let adminUser;
try {
  adminUser = requireAdminAuth();
} catch {}
fillSidebarUser(adminUser);
initSidebarToggle();

const state = {
  page: 1,
  pageSize: 12,
  total: 0,
  totalPages: 1,
  status: "pending_review",
  search: "",
  pendingRejectId: null,
};

const tbody = document.getElementById("verReqTableBody");
const tableTotal = document.getElementById("tableTotal");
const searchInput = document.getElementById("searchInput");
const pagination = document.getElementById("pagination");
const paginationInfo = document.getElementById("paginationInfo");
const pagControls = document.getElementById("paginationControls");
const detailModal = document.getElementById("detailModal");
const detailBody = document.getElementById("detailModalBody");
const detailFooter = document.getElementById("detailModalFooter");
const detailTitle = document.getElementById("detailModalTitle");
const rejectModal = document.getElementById("rejectModal");
const rejectInput = document.getElementById("rejectReasonInput");
const rejectError = document.getElementById("rejectReasonError");

function fmtDate(d) {
  return d
    ? new Date(d).toLocaleDateString("es", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
}

function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const STATUS_BADGE = {
  draft: `<span class="adm-badge" style="background:#f1f5f9;color:#64748b">Borrador</span>`,
  pending_payment: `<span class="adm-badge" style="background:#fef3c7;color:#d97706">Pago Pendiente</span>`,
  payment_confirmed: `<span class="adm-badge" style="background:#e0f2fe;color:#0284c7">Pago Confirmado</span>`,
  pending_review: `<span class="adm-badge adm-badge--pending">En Revisión</span>`,
  approved: `<span class="adm-badge adm-badge--verified">Aprobada</span>`,
  rejected: `<span class="adm-badge adm-badge--rejected">Rechazada</span>`,
  expired: `<span class="adm-badge" style="background:#f1f5f9;color:#64748b">Expirada</span>`,
  cancelled: `<span class="adm-badge" style="background:#f1f5f9;color:#64748b">Cancelada</span>`,
};

async function loadRequests() {
  tbody.innerHTML = `<tr><td colspan="6"><div class="adm-empty" style="padding:40px"><div class="adm-spinner" style="width:28px;height:28px"></div></div></td></tr>`;
  try {
    const res = await verRequestsApi.getAll({
      page: state.page,
      pageSize: state.pageSize,
      status: state.status || undefined,
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
    tbody.innerHTML = `<tr><td colspan="6"><div class="adm-empty"><p class="adm-empty__title">Error al cargar</p><p class="adm-empty__text">${escHtml(err.message)}</p></div></td></tr>`;
  }
}

function renderTable(data) {
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="adm-empty"><div class="adm-empty__icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg></div><p class="adm-empty__title">Sin solicitudes</p><p class="adm-empty__text">No hay solicitudes con el filtro seleccionado.</p></div></td></tr>`;
    return;
  }

  tbody.innerHTML = data
    .map((req) => {
      const companyName = escHtml(
        req.company_name ?? req.supplier_company ?? "—",
      );
      const ownerName = escHtml(
        `${req.owner_first_name ?? ""} ${req.owner_last_name ?? ""}`.trim(),
      );
      const planName = escHtml(req.plan_name ?? "—");
      const payStatus =
        req.payment_status === "completed"
          ? `<span style="color:#16a34a;font-size:12px;font-weight:600">✓ Pagado</span>`
          : `<span style="color:#d97706;font-size:12px">Pendiente</span>`;

      const canReview = req.status === "pending_review";

      return `
      <tr>
        <td>
          <div class="adm-user-cell">
            <div class="adm-avatar" style="border-radius:8px;width:34px;height:34px;font-size:13px">${companyName.slice(0, 2).toUpperCase()}</div>
            <div class="adm-user-cell__info">
              <div class="adm-user-cell__name">${companyName}</div>
              <div class="adm-user-cell__email">${ownerName}</div>
            </div>
          </div>
        </td>
        <td style="font-size:13px">${planName}</td>
        <td>${payStatus}</td>
        <td>${STATUS_BADGE[req.status] ?? `<span class="adm-badge">${escHtml(req.status)}</span>`}</td>
        <td style="color:var(--adm-text-muted);font-size:13px">${fmtDate(req.submitted_at ?? req.created_at)}</td>
        <td>
          <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px">
            <button class="adm-btn adm-btn--secondary adm-btn--sm" data-view="${req.id}">Ver detalle</button>
            ${
              canReview
                ? `
              <button class="adm-btn adm-btn--success adm-btn--sm" data-approve-req="${req.id}" data-name="${companyName}">Aprobar</button>
              <button class="adm-btn adm-btn--danger adm-btn--sm" data-reject-req="${req.id}" data-name="${companyName}">Rechazar</button>
            `
                : ""
            }
          </div>
        </td>
      </tr>
    `;
    })
    .join("");

  tbody
    .querySelectorAll("[data-view]")
    .forEach((btn) =>
      btn.addEventListener("click", () => openDetail(btn.dataset.view)),
    );
  tbody
    .querySelectorAll("[data-approve-req]")
    .forEach((btn) =>
      btn.addEventListener("click", () =>
        handleApprove(btn.dataset.approveReq, btn.dataset.name, btn),
      ),
    );
  tbody
    .querySelectorAll("[data-reject-req]")
    .forEach((btn) =>
      btn.addEventListener("click", () =>
        openRejectModal(btn.dataset.rejectReq),
      ),
    );
}

async function handleApprove(id, name, btn) {
  if (
    !confirm(
      `¿Aprobar la verificación de "${name}"? Esta acción enviará el badge de verificado al proveedor.`,
    )
  )
    return;
  btn.disabled = true;
  btn.textContent = "Aprobando...";
  try {
    await verRequestsApi.approve(id);
    admToast.success(
      `Proveedor "${name}" aprobado exitosamente. Se le notificó por correo.`,
    );
    await loadRequests();
  } catch (err) {
    admToast.error(err.message || "Error al aprobar.");
    btn.disabled = false;
    btn.textContent = "Aprobar";
  }
}

function openRejectModal(requestId) {
  state.pendingRejectId = requestId;
  rejectInput.value = "";
  rejectError.style.display = "none";
  rejectModal.style.display = "flex";
  setTimeout(() => rejectInput.focus(), 100);
}

async function confirmReject() {
  const reason = rejectInput.value.trim();
  if (reason.length < 10) {
    rejectError.style.display = "block";
    return;
  }
  rejectError.style.display = "none";
  const btn = document.getElementById("confirmRejectBtn");
  btn.disabled = true;
  btn.textContent = "Rechazando...";
  try {
    await verRequestsApi.reject(state.pendingRejectId, reason);
    rejectModal.style.display = "none";
    admToast.warning(
      "Solicitud rechazada. El proveedor fue notificado por correo.",
    );
    await loadRequests();
  } catch (err) {
    admToast.error(err.message || "Error al rechazar.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Confirmar rechazo";
    state.pendingRejectId = null;
  }
}

async function openDetail(id) {
  detailTitle.textContent = "Cargando solicitud...";
  detailBody.innerHTML = `<div style="display:flex;justify-content:center;padding:40px"><div class="adm-spinner" style="width:32px;height:32px"></div></div>`;
  detailFooter.innerHTML = "";
  detailModal.style.display = "flex";

  try {
    const res = await verRequestsApi.getDetail(id);
    const r = res.data ?? res;
    detailTitle.textContent = `Solicitud — ${r.company_name ?? "Proveedor"}`;

    const evidenceHtml =
      Array.isArray(r.evidence) && r.evidence.length > 0
        ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px;margin-top:8px">
          ${r.evidence
            .map(
              (ev) => `
            <a href="${escHtml(ev.file_url)}" target="_blank" rel="noopener" style="display:block;border-radius:8px;overflow:hidden;border:1px solid var(--adm-border)">
              <img src="${escHtml(ev.file_url)}" alt="${escHtml(ev.evidence_type)}" style="width:100%;height:80px;object-fit:cover" loading="lazy"/>
            </a>
          `,
            )
            .join("")}
        </div>`
        : `<p style="color:var(--adm-text-muted);font-size:13px;margin-top:8px">Sin evidencias subidas.</p>`;

    detailBody.innerHTML = `
      <div class="adm-detail-card">
        <div class="adm-detail-card__title">Información del Negocio</div>
        <div class="adm-detail-grid">
          <div class="adm-detail-item"><div class="adm-detail-item__label">Empresa</div><div class="adm-detail-item__value">${escHtml(r.company_name ?? "—")}</div></div>
          <div class="adm-detail-item"><div class="adm-detail-item__label">Propietario</div><div class="adm-detail-item__value">${escHtml(`${r.owner_first_name ?? ""} ${r.owner_last_name ?? ""}`.trim())}</div></div>
          <div class="adm-detail-item"><div class="adm-detail-item__label">Email propietario</div><div class="adm-detail-item__value">${escHtml(r.owner_email ?? "—")}</div></div>
          <div class="adm-detail-item"><div class="adm-detail-item__label">Contacto</div><div class="adm-detail-item__value">${escHtml(r.contact_name ?? "—")} ${r.contact_phone ? `· ${r.contact_phone}` : ""}</div></div>
          <div class="adm-detail-item" style="grid-column:1/-1"><div class="adm-detail-item__label">Dirección del negocio</div><div class="adm-detail-item__value">${escHtml(r.business_address ?? "—")}</div></div>
          <div class="adm-detail-item" style="grid-column:1/-1"><div class="adm-detail-item__label">Descripción</div><div class="adm-detail-item__value" style="line-height:1.6">${escHtml(r.business_description ?? "—")}</div></div>
        </div>
      </div>
      <div class="adm-detail-card">
        <div class="adm-detail-card__title">Plan y Pago</div>
        <div class="adm-detail-grid">
          <div class="adm-detail-item"><div class="adm-detail-item__label">Plan</div><div class="adm-detail-item__value">${escHtml(r.plan_name ?? "—")} (${r.plan_duration ?? "—"} mes(es))</div></div>
          <div class="adm-detail-item"><div class="adm-detail-item__label">Monto</div><div class="adm-detail-item__value" style="font-weight:700">$${parseFloat(r.subscription_amount ?? 0).toFixed(2)} USD</div></div>
          <div class="adm-detail-item"><div class="adm-detail-item__label">Estado pago</div><div class="adm-detail-item__value">${STATUS_BADGE[r.payment_status] ?? escHtml(r.payment_status ?? "—")}</div></div>
          <div class="adm-detail-item"><div class="adm-detail-item__label">Fecha pago</div><div class="adm-detail-item__value">${fmtDate(r.paid_at)}</div></div>
          <div class="adm-detail-item"><div class="adm-detail-item__label">ID Externo PayPal</div><div class="adm-detail-item__value" style="font-family:monospace;font-size:12px">${escHtml(r.paypal_order_id ?? "—")}</div></div>
        </div>
      </div>
      <div class="adm-detail-card">
        <div class="adm-detail-card__title">Evidencias (${Array.isArray(r.evidence) ? r.evidence.length : 0})</div>
        ${evidenceHtml}
      </div>
      ${
        r.rejection_reason
          ? `
      <div class="adm-alert adm-alert--danger">
        <div class="adm-alert__text"><strong>Motivo de rechazo:</strong> ${escHtml(r.rejection_reason)}</div>
      </div>`
          : ""
      }
    `;

    if (r.status === "pending_review") {
      detailFooter.innerHTML = `
        <button class="adm-btn adm-btn--secondary" id="detailCloseBtn">Cerrar</button>
        <button class="adm-btn adm-btn--danger" id="detailRejectBtn">Rechazar</button>
        <button class="adm-btn adm-btn--success" id="detailApproveBtn">Aprobar verificación</button>
      `;
      document
        .getElementById("detailApproveBtn")
        .addEventListener("click", async () => {
          detailModal.style.display = "none";
          await handleApprove(r.id, r.company_name, {
            disabled: false,
            textContent: "",
          });
        });
      document
        .getElementById("detailRejectBtn")
        .addEventListener("click", () => {
          detailModal.style.display = "none";
          openRejectModal(r.id);
        });
      document
        .getElementById("detailCloseBtn")
        .addEventListener("click", () => {
          detailModal.style.display = "none";
        });
    } else {
      detailFooter.innerHTML = `<button class="adm-btn adm-btn--secondary" id="detailCloseBtn2">Cerrar</button>`;
      document
        .getElementById("detailCloseBtn2")
        .addEventListener("click", () => {
          detailModal.style.display = "none";
        });
    }
  } catch (err) {
    detailBody.innerHTML = `<div class="adm-alert adm-alert--danger"><div class="adm-alert__text">Error al cargar el detalle: ${escHtml(err.message)}</div></div>`;
  }
}

function renderPagination() {
  if (state.totalPages <= 1) {
    pagination.style.display = "none";
    return;
  }
  pagination.style.display = "flex";
  const start = (state.page - 1) * state.pageSize + 1;
  const end = Math.min(state.page * state.pageSize, state.total);
  paginationInfo.textContent = `${start}–${end} de ${state.total}`;
  pagControls.innerHTML = "";

  const prev = document.createElement("button");
  prev.className = "adm-page-btn";
  prev.innerHTML = "‹";
  prev.disabled = state.page === 1;
  prev.addEventListener("click", () => {
    state.page--;
    loadRequests();
  });
  pagControls.appendChild(prev);

  for (let p = 1; p <= state.totalPages; p++) {
    const pb = document.createElement("button");
    pb.className = `adm-page-btn${p === state.page ? " active" : ""}`;
    pb.textContent = p;
    pb.addEventListener("click", () => {
      state.page = p;
      loadRequests();
    });
    pagControls.appendChild(pb);
  }

  const next = document.createElement("button");
  next.className = "adm-page-btn";
  next.innerHTML = "›";
  next.disabled = state.page === state.totalPages;
  next.addEventListener("click", () => {
    state.page++;
    loadRequests();
  });
  pagControls.appendChild(next);
}

function setActiveFilter(newStatus) {
  state.status = newStatus;
  state.page = 1;
  document.querySelectorAll("[data-status-filter]").forEach((btn) => {
    btn.className =
      btn.dataset.statusFilter === newStatus
        ? "adm-btn adm-btn--primary adm-btn--sm"
        : "adm-btn adm-btn--secondary adm-btn--sm";
  });
  loadRequests();
}

document
  .querySelectorAll("[data-status-filter]")
  .forEach((btn) =>
    btn.addEventListener("click", () =>
      setActiveFilter(btn.dataset.statusFilter),
    ),
  );

let searchTimeout = null;
searchInput?.addEventListener("input", () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    state.search = searchInput.value.trim();
    state.page = 1;
    loadRequests();
  }, 400);
});

document.getElementById("closeDetailModal")?.addEventListener("click", () => {
  detailModal.style.display = "none";
});
detailModal?.addEventListener("click", (e) => {
  if (e.target === detailModal) detailModal.style.display = "none";
});
document.getElementById("closeRejectModal")?.addEventListener("click", () => {
  rejectModal.style.display = "none";
});
document.getElementById("cancelRejectBtn")?.addEventListener("click", () => {
  rejectModal.style.display = "none";
});
document
  .getElementById("confirmRejectBtn")
  ?.addEventListener("click", confirmReject);
rejectModal?.addEventListener("click", (e) => {
  if (e.target === rejectModal) rejectModal.style.display = "none";
});

document.addEventListener("DOMContentLoaded", loadRequests);
