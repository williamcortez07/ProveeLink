/**
 * @file createSupplier.js
 * @description Lógica del módulo "Convertir Empresa en Proveedor / Registrar Proveedor".
 *
 * Flujo de negocio:
 * 1. Cliente ingresa a la plataforma.
 * 2. Verifica si el usuario tiene una Empresa vinculada.
 *    - Si NO tiene empresa -> Muestra pantalla de aviso para registrar empresa primero.
 * 3. Verifica si la Empresa ya está registrada como Proveedor en /suppliers.
 *    - Si YA es proveedor -> Muestra aviso indicando que la empresa ya opera como proveedor.
 * 4. Si la Empresa existe y NO es proveedor:
 *    - Reutiliza la información existente del usuario y la empresa para pre-poblar el resumen.
 *    - Detecta si falta información clave (ej. ID Fiscal o Teléfono) y solicita ÚNICAMENTE los datos pendientes.
 * 5. Al enviar, actualiza primero los datos pendientes de la empresa (si aplica), crea el perfil
 *    de Proveedor en POST /api/v1/suppliers y actualiza el token JWT del usuario al nuevo rol.
 */

import { TokenManager } from "../services/api.js";
import { companyService } from "../services/companyService.js";
import { supplierService } from "../services/supplierService.js";
import { NotificationManager } from "../services/notificationService.js";

// Estado interno del módulo
const state = {
  user: null,
  company: null,
  supplier: null,
  isSubmitting: false,
  missingFields: {
    tax_id: false,
    phone: false,
  },
};

// Elementos del DOM
const DOM = {
  loadingOverlay: document.getElementById("page-loading-overlay"),
  mainContent: document.getElementById("create-supplier-main-content"),
  noCompanyBlock: document.getElementById("no-company-block"),
  alreadySupplierBlock: document.getElementById("already-supplier-block"),

  // Resumen de empresa
  summaryCompanyName: document.getElementById("summary-company-name"),
  summaryTaxId: document.getElementById("summary-tax-id"),
  summaryLocation: document.getElementById("summary-location"),
  summaryEmail: document.getElementById("summary-email"),
  summaryPhone: document.getElementById("summary-phone"),

  // Campos de información faltante
  missingInfoSection: document.getElementById("missing-info-section"),
  missingTaxIdGroup: document.getElementById("missing-tax-id-group"),
  missingTaxIdInput: document.getElementById("missing-tax-id"),
  missingPhoneGroup: document.getElementById("missing-phone-group"),
  missingPhoneInput: document.getElementById("missing-phone"),

  // Formulario y campos
  form: document.getElementById("create-supplier-form"),
  supplierType: document.getElementById("supplier-type"),
  geographicCoverage: document.getElementById("geographic-coverage"),
  operatingHours: document.getElementById("operating-hours"),
  serviceDescription: document.getElementById("service-description"),

  // Botón de submit y estados
  submitBtn: document.getElementById("btn-create-supplier"),
  submitIcon: document.getElementById("btn-create-supplier-icon"),
  submitSpinner: document.getElementById("btn-create-supplier-spinner"),
  submitText: document.getElementById("btn-create-supplier-text"),
};

/**
 * Muestra u oculta mensajes de error para cada campo del formulario.
 * @param {HTMLElement} inputEl
 * @param {string} errorId
 * @param {string|null} message
 */
function setFieldError(inputEl, errorId, message) {
  const errorEl = document.getElementById(errorId);
  if (!inputEl || !errorEl) return;

  if (message) {
    inputEl.classList.add("is-error");
    errorEl.textContent = message;
    errorEl.classList.add("is-visible");
  } else {
    inputEl.classList.remove("is-error");
    errorEl.textContent = "";
    errorEl.classList.remove("is-visible");
  }
}

/**
 * Limpia todos los errores del formulario.
 */
function clearAllErrors() {
  setFieldError(DOM.supplierType, "error-supplier-type", null);
  setFieldError(DOM.geographicCoverage, "error-geographic-coverage", null);
  setFieldError(DOM.operatingHours, "error-operating-hours", null);
  setFieldError(DOM.serviceDescription, "error-service-description", null);
  if (DOM.missingTaxIdInput) setFieldError(DOM.missingTaxIdInput, "error-missing-tax-id", null);
  if (DOM.missingPhoneInput) setFieldError(DOM.missingPhoneInput, "error-missing-phone", null);
}

/**
 * Renderiza el cuadro de resumen de la empresa con los datos recuperados de la BD.
 */
function renderCompanySummary() {
  const company = state.company;
  const user = state.user;
  if (!company) return;

  if (DOM.summaryCompanyName) DOM.summaryCompanyName.textContent = company.name || "Mi Empresa";
  if (DOM.summaryTaxId) DOM.summaryTaxId.textContent = company.tax_id || "No especificado (Pendiente)";

  const locationParts = [company.city, company.state_province].filter(Boolean);
  if (DOM.summaryLocation) {
    DOM.summaryLocation.textContent = locationParts.length > 0 ? locationParts.join(", ") : "No especificada";
  }

  if (DOM.summaryEmail) DOM.summaryEmail.textContent = company.email || user?.email || "No especificado";
  if (DOM.summaryPhone) DOM.summaryPhone.textContent = company.phone || user?.phone || "No especificado (Pendiente)";
}

/**
 * Verifica si falta información clave en el perfil del usuario o la empresa.
 */
function checkAndSetupMissingFields() {
  const company = state.company;
  const user = state.user;

  let hasMissing = false;

  // Verificar si falta ID Fiscal / RTN
  if (!company.tax_id || company.tax_id.trim() === "") {
    state.missingFields.tax_id = true;
    hasMissing = true;
    if (DOM.missingTaxIdGroup) DOM.missingTaxIdGroup.style.display = "flex";
  } else {
    state.missingFields.tax_id = false;
    if (DOM.missingTaxIdGroup) DOM.missingTaxIdGroup.style.display = "none";
  }

  // Verificar si falta teléfono de contacto
  const hasPhone = Boolean(company.phone?.trim() || user?.phone?.trim());
  if (!hasPhone) {
    state.missingFields.phone = true;
    hasMissing = true;
    if (DOM.missingPhoneGroup) DOM.missingPhoneGroup.style.display = "flex";
  } else {
    state.missingFields.phone = false;
    if (DOM.missingPhoneGroup) DOM.missingPhoneGroup.style.display = "none";
  }

  if (hasMissing && DOM.missingInfoSection) {
    DOM.missingInfoSection.style.display = "block";
  } else if (DOM.missingInfoSection) {
    DOM.missingInfoSection.style.display = "none";
  }
}

/**
 * Verifica autenticación, existencia de empresa y perfil de proveedor previo.
 */
async function checkAccessGuard() {
  if (!TokenManager.isAuthenticated()) {
    NotificationManager.warn("Debes iniciar sesión para acceder a esta vista.");
    window.location.href = "../../index.html";
    return;
  }

  state.user = TokenManager.getUser();

  try {
    // 1. Obtener la empresa vinculada al usuario
    const userCompany = await companyService.getByUserId(state.user.id);
    if (!userCompany) {
      // El usuario no tiene empresa -> mostrar aviso de "registra tu empresa"
      DOM.loadingOverlay.style.display = "none";
      DOM.mainContent.style.display = "none";
      DOM.alreadySupplierBlock.style.display = "none";
      DOM.noCompanyBlock.style.display = "flex";
      return;
    }

    state.company = userCompany;

    // 2. Verificar si la empresa ya es Proveedor
    const existingSupplier = await supplierService.getByCompanyId(userCompany.id);
    if (existingSupplier) {
      // Ya está registrada como proveedor -> mostrar aviso "already supplier"
      state.supplier = existingSupplier;
      DOM.loadingOverlay.style.display = "none";
      DOM.mainContent.style.display = "none";
      DOM.noCompanyBlock.style.display = "none";
      DOM.alreadySupplierBlock.style.display = "flex";
      return;
    }

    // 3. La empresa existe y NO es proveedor -> preparar vista y verificar datos pendientes
    renderCompanySummary();
    checkAndSetupMissingFields();

    DOM.loadingOverlay.style.display = "none";
    DOM.noCompanyBlock.style.display = "none";
    DOM.alreadySupplierBlock.style.display = "none";
    DOM.mainContent.style.display = "block";

  } catch (error) {
    console.error("Error durante verificación de acceso:", error);
    DOM.loadingOverlay.style.display = "none";
    NotificationManager.error(
      "No se pudieron verificar los datos de tu cuenta. Por favor reintenta."
    );
  }
}

/**
 * Valida los datos introducidos en el formulario.
 * @returns {boolean} True si el formulario es válido.
 */
function validateForm() {
  clearAllErrors();
  let isValid = true;

  // Validar campos de información faltante de la empresa si están visibles
  if (state.missingFields.tax_id) {
    const taxIdVal = DOM.missingTaxIdInput?.value.trim() ?? "";
    if (!taxIdVal) {
      setFieldError(DOM.missingTaxIdInput, "error-missing-tax-id", "El ID Fiscal / RTN es requerido.");
      isValid = false;
    } else if (taxIdVal.length < 3) {
      setFieldError(DOM.missingTaxIdInput, "error-missing-tax-id", "El ID Fiscal debe tener al menos 3 caracteres.");
      isValid = false;
    }
  }

  if (state.missingFields.phone) {
    const phoneVal = DOM.missingPhoneInput?.value.trim() ?? "";
    if (!phoneVal) {
      setFieldError(DOM.missingPhoneInput, "error-missing-phone", "El teléfono de contacto es requerido.");
      isValid = false;
    } else if (!/^\+?[0-9\s\-.]{7,20}$/.test(phoneVal)) {
      setFieldError(DOM.missingPhoneInput, "error-missing-phone", "Formato de teléfono no válido (ej. +50499887766).");
      isValid = false;
    }
  }

  const supplierTypeVal = DOM.supplierType.value.trim();
  const geoCoverageVal = DOM.geographicCoverage.value.trim();
  const operatingHoursVal = DOM.operatingHours.value.trim();
  const serviceDescVal = DOM.serviceDescription.value.trim();

  // Tipo de proveedor
  if (!supplierTypeVal) {
    setFieldError(DOM.supplierType, "error-supplier-type", "Selecciona el tipo de proveedor.");
    isValid = false;
  }

  // Cobertura geográfica
  if (!geoCoverageVal || !["local", "regional", "national"].includes(geoCoverageVal)) {
    setFieldError(DOM.geographicCoverage, "error-geographic-coverage", "Selecciona una cobertura válida.");
    isValid = false;
  }

  // Horario de atención
  if (!operatingHoursVal) {
    setFieldError(DOM.operatingHours, "error-operating-hours", "El horario de atención es obligatorio.");
    isValid = false;
  } else if (operatingHoursVal.length < 5) {
    setFieldError(DOM.operatingHours, "error-operating-hours", "El horario debe tener al menos 5 caracteres.");
    isValid = false;
  }

  // Descripción del servicio
  if (!serviceDescVal) {
    setFieldError(DOM.serviceDescription, "error-service-description", "La descripción de productos/servicios es obligatoria.");
    isValid = false;
  } else if (serviceDescVal.length < 5) {
    setFieldError(DOM.serviceDescription, "error-service-description", "La descripción debe tener al menos 5 caracteres.");
    isValid = false;
  }

  return isValid;
}

/**
 * Maneja el envío del formulario de registro de proveedor.
 * @param {SubmitEvent} event
 */
async function handleFormSubmit(event) {
  event.preventDefault();
  if (state.isSubmitting) return;

  if (!validateForm()) {
    NotificationManager.warn("Por favor corrige los errores del formulario.");
    return;
  }

  state.isSubmitting = true;
  DOM.submitBtn.disabled = true;
  DOM.submitIcon.style.display = "none";
  DOM.submitSpinner.style.display = "inline-block";
  DOM.submitText.textContent = "Registrando proveedor…";

  try {
    // 1. Si había información de la empresa faltante, actualizar la empresa primero
    const companyUpdates = {};
    if (state.missingFields.tax_id && DOM.missingTaxIdInput?.value.trim()) {
      companyUpdates.tax_id = DOM.missingTaxIdInput.value.trim();
    }
    if (state.missingFields.phone && DOM.missingPhoneInput?.value.trim()) {
      companyUpdates.phone = DOM.missingPhoneInput.value.trim();
    }

    if (Object.keys(companyUpdates).length > 0) {
      try {
        const updateRes = await companyService.update(state.company.id, companyUpdates);
        if (updateRes?.data) {
          state.company = updateRes.data;
        }
      } catch (companyErr) {
        console.warn("No se pudo actualizar la información secundaria de la empresa:", companyErr);
      }
    }

    // 2. Registrar el perfil de Proveedor
    const payload = {
      company_id: state.company.id,
      supplier_type: DOM.supplierType.value.trim(),
      geographic_coverage: DOM.geographicCoverage.value.trim(),
      operating_hours: DOM.operatingHours.value.trim(),
      service_description: DOM.serviceDescription.value.trim(),
    };

    const response = await supplierService.create(payload);

    // 3. Si el backend retornó tokens de actualización de rol, guardarlos
    if (response?.auth) {
      TokenManager.saveToken(response.auth);
    } else {
      // Intentar actualización de rol explícita
      try {
        const upgradeRes = await supplierService.upgradeRole();
        if (upgradeRes?.data) {
          TokenManager.saveToken(upgradeRes.data);
        }
      } catch {
        // Ignorar si el rol ya estaba actualizado
      }
    }

    sessionStorage.setItem("supplier_just_created", "true");
    NotificationManager.success("¡Tu empresa ahora opera como Proveedor!");

    setTimeout(() => {
      window.location.href = "./homeSupplier.html";
    }, 600);

  } catch (error) {
    console.error("Error al registrar proveedor:", error);
    state.isSubmitting = false;
    DOM.submitBtn.disabled = false;
    DOM.submitIcon.style.display = "flex";
    DOM.submitSpinner.style.display = "none";
    DOM.submitText.textContent = "Registrar como Proveedor";

    const errorMsg = error?.data?.message || error.message || "Ocurrió un error al registrar el proveedor.";
    NotificationManager.error(errorMsg);
  }
}

/**
 * Inicialización de la vista.
 */
function init() {
  checkAccessGuard();

  if (DOM.form) {
    DOM.form.addEventListener("submit", handleFormSubmit);
  }
}

document.addEventListener("DOMContentLoaded", init);
