/**
 * @file verification.js
 * @description Gestor de la vista del Proveedor para el Proceso de Verificación con Suscripción.
 *
 * Flujo:
 * 1. Cargar estado actual con GET /api/v1/verification/requests/me
 * 2. Si no tiene solicitud o está en 'draft': mostrar Wizard (Paso 1: Datos, Paso 2: Evidencias 5-10 fotos, Paso 3: Selección de Plan + PayPal)
 * 3. Si está en 'pending_payment': ir directo a Selección de Plan + PayPal
 * 4. Si está en 'pending_review': mostrar pantalla de confirmación "En revisión administrativa"
 * 5. Si está en 'approved': mostrar banner "Cuenta Verificada" con vigencia
 * 6. Si está en 'rejected': mostrar motivo de rechazo y opción de reiniciar/reenviar
 */

import { apiFetch, TokenManager, RoleManager, ROLES } from "../services/api.js";
import { NotificationService } from "../services/notificationService.js";
import { uploadVerificationEvidence } from "../services/storageService.js";
import { Router } from "../services/routes.js";

// Inicializar guard de rol
Router.init();

// State Manager
const state = {
  request: null,
  evidence: [],
  subscription: null,
  plans: [],
  selectedPlanId: null,
  currentStep: 1,
};

// Elements
const loadingOverlay = document.getElementById("page-loading-overlay");
const statusDisplayText = document.getElementById("status-display-text");
const statusBadgeContainer = document.getElementById("status-badge-container");
const rejectionAlert = document.getElementById("rejection-alert");
const rejectionReasonText = document.getElementById("rejection-reason-text");
const activeSubAlert = document.getElementById("active-subscription-alert");
const subDatesInfo = document.getElementById("subscription-dates-info");
const wizardContainer = document.getElementById("wizard-container");
const pendingReviewSection = document.getElementById("pending-review-section");

const stepNode1 = document.getElementById("step-node-1");
const stepNode2 = document.getElementById("step-node-2");
const stepNode3 = document.getElementById("step-node-3");

const stepContent1 = document.getElementById("step-content-1");
const stepContent2 = document.getElementById("step-content-2");
const stepContent3 = document.getElementById("step-content-3");

const verificationForm = document.getElementById("verification-form");
const businessDescInput = document.getElementById("business_description");
const businessAddressInput = document.getElementById("business_address");
const contactNameInput = document.getElementById("contact_name");
const contactPhoneInput = document.getElementById("contact_phone");

const evidenceFileInput = document.getElementById("evidence-file-input");
const evidenceGallery = document.getElementById("evidence-gallery");
const plansContainer = document.getElementById("plans-container");
const paypalSection = document.getElementById("paypal-section");
const paypalButtonContainer = document.getElementById("paypal-button-container");

const BADGE_MAP = {
  draft: '<span class="verif-status-badge draft">Borrador</span>',
  pending_payment: '<span class="verif-status-badge pending_payment">Pago Pendiente</span>',
  pending_review: '<span class="verif-status-badge pending_review">En Revisión</span>',
  approved: '<span class="verif-status-badge approved">Verificado ✓</span>',
  rejected: '<span class="verif-status-badge rejected">Rechazado</span>',
  expired: '<span class="verif-status-badge expired">Suscripción Vencida</span>',
};

const STATUS_TEXT_MAP = {
  draft: "Solicitud en Borrador",
  pending_payment: "Pendiente de Selección de Plan o Pago",
  pending_review: "Solicitud Recibida — En Revisión por Administración",
  approved: "Proveedor Verificado Oficialmente",
  rejected: "Solicitud Rechazada por Administración",
  expired: "Suscripción Expirada",
};

/**
 * Inicialización principal
 */
async function init() {
  try {
    await loadVerificationState();
    await loadSubscriptionPlans();
  } catch (err) {
    console.error("[Verification] Error inicial:", err);
    NotificationService.showToast("Error al cargar datos de verificación: " + err.message, "error");
  } finally {
    if (loadingOverlay) loadingOverlay.style.display = "none";
  }
}

/**
 * Obtener la solicitud activa del proveedor
 */
async function loadVerificationState() {
  try {
    const res = await apiFetch("/verification/requests/me");
    if (res.success && res.data) {
      state.request = res.data.request ?? res.data;
      state.evidence = res.data.evidence ?? [];
      state.subscription = res.data.subscription ?? null;
      renderStateUI();
    } else {
      renderNoRequestUI();
    }
  } catch (err) {
    if (err.message.includes("404") || err.status === 404) {
      renderNoRequestUI();
    } else {
      throw err;
    }
  }
}

/**
 * Renderizar UI según el estado de la solicitud
 */
function renderStateUI() {
  const req = state.request;
  if (!req) {
    renderNoRequestUI();
    return;
  }

  statusDisplayText.textContent = STATUS_TEXT_MAP[req.status] || req.status;
  statusBadgeContainer.innerHTML = BADGE_MAP[req.status] || `<span class="verif-status-badge">${req.status}</span>`;

  // Pre-llenar campos de formulario
  if (req.business_description) businessDescInput.value = req.business_description;
  if (req.business_address) businessAddressInput.value = req.business_address;
  if (req.contact_name) contactNameInput.value = req.contact_name;
  if (req.contact_phone) contactPhoneInput.value = req.contact_phone;

  renderEvidenceGallery();

  // Reset visibilidad
  rejectionAlert.style.display = "none";
  activeSubAlert.style.display = "none";
  wizardContainer.style.display = "none";
  pendingReviewSection.style.display = "none";

  if (req.status === "rejected") {
    rejectionAlert.style.display = "block";
    rejectionReasonText.textContent = req.rejection_reason || "No se especificó un motivo particular.";
    wizardContainer.style.display = "block";
    goToStep(1);
  } else if (req.status === "approved") {
    activeSubAlert.style.display = "block";
    if (state.subscription && state.subscription.end_date) {
      const endFmt = new Date(state.subscription.end_date).toLocaleDateString("es", { day: "2-digit", month: "long", year: "numeric" });
      subDatesInfo.textContent = `Tu suscripción de verificado está activa hasta el ${endFmt}.`;
    } else {
      subDatesInfo.textContent = "Tu cuenta goza del distintivo de Verificado y todos sus beneficios.";
    }
  } else if (req.status === "pending_review") {
    pendingReviewSection.style.display = "block";
  } else if (req.status === "pending_payment") {
    wizardContainer.style.display = "block";
    goToStep(3);
  } else {
    // draft o expired
    wizardContainer.style.display = "block";
    goToStep(1);
  }
}

function renderNoRequestUI() {
  statusDisplayText.textContent = "Sin Solicitud Iniciada";
  statusBadgeContainer.innerHTML = BADGE_MAP.draft;
  wizardContainer.style.display = "block";
  goToStep(1);
}

/**
 * Control del Wizard de Pasos
 */
function goToStep(step) {
  state.currentStep = step;

  stepNode1.classList.remove("active", "completed");
  stepNode2.classList.remove("active", "completed");
  stepNode3.classList.remove("active", "completed");

  stepContent1.style.display = "none";
  stepContent2.style.display = "none";
  stepContent3.style.display = "none";

  if (step === 1) {
    stepNode1.classList.add("active");
    stepContent1.style.display = "block";
  } else if (step === 2) {
    stepNode1.classList.add("completed");
    stepNode2.classList.add("active");
    stepContent2.style.display = "block";
  } else if (step === 3) {
    stepNode1.classList.add("completed");
    stepNode2.classList.add("completed");
    stepNode3.classList.add("active");
    stepContent3.style.display = "block";
  }
}

/**
 * PASO 1: Formulario Guardar Solicitud
 */
verificationForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const desc = businessDescInput.value.trim();
  const addr = businessAddressInput.value.trim();
  const name = contactNameInput.value.trim();
  const phone = contactPhoneInput.value.trim();

  if (desc.length < 10) {
    NotificationService.showToast("La descripción debe tener al menos 10 caracteres.", "warning");
    return;
  }
  if (addr.length < 5) {
    NotificationService.showToast("La dirección debe tener al menos 5 caracteres.", "warning");
    return;
  }

  const btn = document.getElementById("btn-save-step1");
  btn.disabled = true;
  btn.textContent = "Guardando...";

  try {
    let res;
    if (state.request && state.request.id) {
      res = await apiFetch(`/verification/requests/${state.request.id}`, {
        method: "PUT",
        body: JSON.stringify({ business_description: desc, business_address: addr, contact_name: name, contact_phone: phone })
      });
    } else {
      res = await apiFetch("/verification/requests", {
        method: "POST",
        body: JSON.stringify({ business_description: desc, business_address: addr, contact_name: name, contact_phone: phone })
      });
    }

    if (res.success) {
      state.request = res.data;
      NotificationService.showToast("Datos de negocio guardados.", "success");
      goToStep(2);
    }
  } catch (err) {
    NotificationService.showToast("Error al guardar: " + err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Guardar y Continuar a Evidencias \u2192";
  }
});

/**
 * PASO 2: Evidencias Fotográficas
 */
evidenceFileInput?.addEventListener("change", async (e) => {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  if (!state.request || !state.request.id) {
    NotificationService.showToast("Primero guarda los datos del negocio en el Paso 1.", "warning");
    goToStep(1);
    return;
  }

  if (state.evidence.length + files.length > 10) {
    NotificationService.showToast(`El límite máximo es de 10 fotografías. Actualmente tienes ${state.evidence.length}.`, "warning");
    return;
  }

  NotificationService.showToast("Subiendo imágenes de evidencia...", "info");

  for (const file of files) {
    try {
      const publicUrl = await uploadVerificationEvidence(file, state.request.id);
      const res = await apiFetch(`/verification/requests/${state.request.id}/evidence`, {
        method: "POST",
        body: JSON.stringify({
          file_url: publicUrl,
          file_name: file.name,
          evidence_type: "photo"
        })
      });
      if (res.success && res.data) {
        state.evidence.push(res.data);
      }
    } catch (err) {
      NotificationService.showToast(`Error al subir ${file.name}: ${err.message}`, "error");
    }
  }

  renderEvidenceGallery();
  evidenceFileInput.value = "";
  NotificationService.showToast("Evidencias subidas correctamente.", "success");
});

function renderEvidenceGallery() {
  if (!evidenceGallery) return;
  if (!state.evidence || state.evidence.length === 0) {
    evidenceGallery.innerHTML = `<p style="grid-column: 1/-1; color: #94a3b8; font-size: 0.9rem; text-align: center;">No has subido ninguna fotografía de evidencia todavía (Mínimo recomendado: 5-10 fotos).</p>`;
    return;
  }

  evidenceGallery.innerHTML = state.evidence.map((item) => `
    <div class="evidence-item">
      <img src="${item.file_url}" alt="${item.file_name || 'Evidencia'}" />
      <button type="button" class="remove-btn" data-id="${item.id}" title="Eliminar foto">&times;</button>
    </div>
  `).join("");

  evidenceGallery.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => deleteEvidence(btn.dataset.id));
  });
}

async function deleteEvidence(evidenceId) {
  if (!confirm("¿Deseas eliminar esta foto de evidencia?")) return;
  try {
    const res = await apiFetch(`/verification/requests/${state.request.id}/evidence/${evidenceId}`, {
      method: "DELETE"
    });
    if (res.success) {
      state.evidence = state.evidence.filter((e) => e.id !== evidenceId);
      renderEvidenceGallery();
      NotificationService.showToast("Evidencia eliminada.", "info");
    }
  } catch (err) {
    NotificationService.showToast("Error al eliminar evidencia: " + err.message, "error");
  }
}

document.getElementById("btn-back-step1")?.addEventListener("click", () => goToStep(1));

document.getElementById("btn-to-step3")?.addEventListener("click", () => {
  if (state.evidence.length < 5) {
    if (!confirm(`Has subido ${state.evidence.length} fotos (se recomiendan de 5 a 10 fotos). ¿Deseas continuar de todos modos a la selección de plan?`)) {
      return;
    }
  }
  goToStep(3);
});

/**
 * PASO 3: Cargar Planes y PayPal
 */
async function loadSubscriptionPlans() {
  try {
    const res = await apiFetch("/verification/plans");
    if (res.success && res.data) {
      state.plans = res.data;
      renderPlans();
    }
  } catch (err) {
    console.error("[Verification] Error al cargar planes:", err);
  }
}

function renderPlans() {
  if (!plansContainer) return;
  if (!state.plans.length) {
    plansContainer.innerHTML = `<p style="grid-column: 1/-1; color: #94a3b8; text-align: center;">No hay planes de suscripción disponibles en este momento.</p>`;
    return;
  }

  plansContainer.innerHTML = state.plans.map((p) => {
    const isPopular = p.duration_months === 6;
    const isSelected = state.selectedPlanId === p.id;
    return `
      <div class="plan-card ${isPopular ? 'popular' : ''} ${isSelected ? 'selected' : ''}" data-plan-id="${p.id}">
        <div class="plan-name">${p.name}</div>
        <div class="plan-price">$${Number(p.final_price).toFixed(2)} <span>USD / ${p.duration_months} mes${p.duration_months > 1 ? 'es' : ''}</span></div>
        ${p.discount_pct > 0 ? `<div class="plan-badge">${p.discount_pct}% de Ahorro</div>` : ''}
        <p style="font-size:0.85rem; color:#64748b; margin-top:12px; line-height:1.4;">
          Suscripción oficial con verificación, insignia destacada y renovaciones ilimitadas.
        </p>
      </div>
    `;
  }).join("");

  plansContainer.querySelectorAll(".plan-card").forEach((card) => {
    card.addEventListener("click", () => selectPlan(card.dataset.planId));
  });
}

async function selectPlan(planId) {
  state.selectedPlanId = planId;
  renderPlans();

  if (!state.request || !state.request.id) {
    NotificationService.showToast("Primero debes guardar tus datos en el Paso 1.", "warning");
    goToStep(1);
    return;
  }

  try {
    const res = await apiFetch(`/verification/requests/${state.request.id}/subscription`, {
      method: "POST",
      body: JSON.stringify({ plan_id: planId })
    });

    if (res.success) {
      NotificationService.showToast("Plan seleccionado. Procediendo a pago...", "info");
      paypalSection.style.display = "block";
      initPayPalSDK();
    }
  } catch (err) {
    NotificationService.showToast("Error al seleccionar plan: " + err.message, "error");
  }
}

/**
 * Inicializar Botones de PayPal SDK
 */
function initPayPalSDK() {
  if (!paypalButtonContainer) return;
  paypalButtonContainer.innerHTML = "";

  if (typeof window.paypal === "undefined") {
    paypalButtonContainer.innerHTML = `<p style="color:#ef4444; text-align:center;">Error al cargar el SDK de PayPal. Por favor recarga la página.</p>`;
    return;
  }

  const selectedPlan = state.plans.find((p) => p.id === state.selectedPlanId);
  const amount = selectedPlan ? Number(selectedPlan.final_price).toFixed(2) : "3.00";

  window.paypal.Buttons({
    style: {
      layout: "vertical",
      color: "gold",
      shape: "rect",
      label: "paypal"
    },
    createOrder: (data, actions) => {
      return actions.order.create({
        purchase_units: [{
          description: `Suscripción Verificación ProveeLink - ${selectedPlan ? selectedPlan.name : 'Plan'}`,
          amount: {
            currency_code: "USD",
            value: amount
          }
        }]
      });
    },
    onApprove: async (data, actions) => {
      NotificationService.showToast("Procesando pago con PayPal...", "info");
      try {
        const details = await actions.order.capture();
        console.log("[PayPal] Order Captured:", details);

        // Notificar al backend de la captura exitosa
        const res = await apiFetch(`/verification/requests/${state.request.id}/payment`, {
          method: "POST",
          body: JSON.stringify({ paypal_order_id: details.id })
        });

        if (res.success) {
          NotificationService.showToast("¡Pago realizado con éxito! Tu solicitud pasó a revisión.", "success");
          await loadVerificationState();
        } else {
          NotificationService.showToast("Pago recibido pero hubo un detalle: " + (res.message || ""), "warning");
        }
      } catch (err) {
        console.error("[PayPal Error]", err);
        NotificationService.showToast("Error al confirmar pago con el servidor: " + err.message, "error");
      }
    },
    onError: (err) => {
      console.error("[PayPal SDK Error]", err);
      NotificationService.showToast("Ocurrió un error en la pasarela de PayPal.", "error");
    }
  }).render("#paypal-button-container");
}

document.getElementById("btn-back-step2")?.addEventListener("click", () => goToStep(2));
document.getElementById("btn-reapply")?.addEventListener("click", () => {
  rejectionAlert.style.display = "none";
  wizardContainer.style.display = "block";
  goToStep(1);
});

document.addEventListener("DOMContentLoaded", init);
