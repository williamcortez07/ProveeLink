/**
 * @file createCompany.js
 * @description Módulo de registro de empresa.
 *
 * Responsabilidades (SRP):
 *  1. Verificar sesión activa y rol autorizado (ROLES.USER).
 *  2. Verificar si el usuario YA tiene empresa registrada (redirect guard).
 *  3. Renderizar y gestionar el formulario de creación.
 *  4. Validar datos del formulario (frontend).
 *  5. Enviar el DTO real al endpoint POST /api/v1/companies.
 *  6. Tras éxito: actualizar el token (re-login) y redirigir a HomeCompany.
 *  7.
 */

import { TokenManager, RoleManager, ROLES } from "../services/api.js";
import { companyService } from "../services/companyService.js";
import { notify } from "../services/notificationService.js";
import { Router } from "../services/routes.js";

const HOME_COMPANY_PATH = "./homeCompany.html";

const Validators = {
  /**
   * Nombre de empresa: 2–100 chars, no solo espacios.
   * @param {string} v
   * @returns {string|null} Mensaje de error o null si es válido.
   */
  name(v) {
    const trimmed = v.trim();
    if (!trimmed) return "El nombre de la empresa es obligatorio.";
    if (trimmed.length < 2)
      return "El nombre debe tener al menos 2 caracteres.";
    if (trimmed.length > 100)
      return "El nombre no debe superar los 100 caracteres.";
    return null;
  },

  /**
   * Teléfono: 7–20 dígitos/espacios/guiones, puede iniciar con +.
   * @param {string} v
   * @returns {string|null}
   */
  phone(v) {
    const trimmed = v.trim();
    if (!trimmed) return "El teléfono de contacto es obligatorio.";
    if (!/^\+?[0-9\s\-.]{7,20}$/.test(trimmed)) {
      return "El teléfono no tiene un formato válido (ej. +50422334455).";
    }
    return null;
  },

  /**
   * Email válido.
   * @param {string} v
   * @returns {string|null}
   */
  email(v) {
    const trimmed = v.trim();
    if (!trimmed) return "El correo electrónico es obligatorio.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
      return "El correo electrónico no tiene un formato válido.";
    }
    return null;
  },

  /**
   * Dirección: mínimo 5 chars.
   * @param {string} v
   * @returns {string|null}
   */
  address(v) {
    const trimmed = v.trim();
    if (!trimmed) return "La dirección es obligatoria.";
    if (trimmed.length < 5)
      return "La dirección debe tener al menos 5 caracteres.";
    return null;
  },

  /**
   * Estado/Provincia/Municipio: mínimo 5 chars.
   * @param {string} v
   * @returns {string|null}
   */
  state_province(v) {
    const trimmed = v.trim();
    if (!trimmed) return "El estado/provincia/Municipio es obligatorio.";
    if (trimmed.length < 5)
      return "El estado/provincia debe tener al menos 5 caracteres.";
    return null;
  },

  /**
   * Ciudad: mínimo 5 chars (validación del backend).
   * @param {string} v
   * @returns {string|null}
   */
  city(v) {
    const trimmed = v.trim();
    if (!trimmed) return "La ciudad es obligatoria.";
    if (trimmed.length < 5)
      return "La ciudad debe tener al menos 5 caracteres.";
    return null;
  },

  /**
   * URL: válida si se provee, puede estar vacía (campo opcional).
   * @param {string} v
   * @returns {string|null}
   */
  url(v) {
    const trimmed = v.trim();
    if (!trimmed) return null;
    try {
      const url = new URL(trimmed);
      if (!["http:", "https:"].includes(url.protocol)) {
        return "La URL debe comenzar con http:// o https://";
      }
    } catch {
      return "La URL no tiene un formato válido.";
    }
    return null;
  },
};

/**
 * Muestra un mensaje de error en el campo especificado.
 * @param {string} fieldId - ID del campo de input.
 * @param {string} message - Mensaje de error.
 */
function showFieldError(fieldId, message) {
  const input = document.getElementById(fieldId);
  const errorEl = document.getElementById(`error-${fieldId}`);
  input?.classList.add("is-error");
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.classList.add("is-visible");
  }
}

/**
 * Limpia el estado de error de un campo.
 * @param {string} fieldId
 */
function clearFieldError(fieldId) {
  const input = document.getElementById(fieldId);
  const errorEl = document.getElementById(`error-${fieldId}`);
  input?.classList.remove("is-error");
  if (errorEl) {
    errorEl.textContent = "";
    errorEl.classList.remove("is-visible");
  }
}

/**
 * Limpia todos los errores de todos los campos del formulario.
 */
function clearAllErrors() {
  const fields = [
    "company-name",
    "company-phone",
    "company-email",
    "company-address",
    "company-state",
    "company-city",
    "company-tax-id",
    "company-description",
    "company-website",
    "company-logo",
  ];
  fields.forEach(clearFieldError);
}

/**
 * Activa/desactiva el estado de carga del botón de envío.
 * @param {boolean} isLoading
 */
function setButtonLoading(isLoading) {
  const btn = document.getElementById("btn-create-company");
  const btnText = document.getElementById("btn-create-company-text");
  const btnIcon = document.getElementById("btn-create-company-icon");
  const btnSpinner = document.getElementById("btn-create-company-spinner");

  if (!btn) return;

  btn.disabled = isLoading;

  if (btnText)
    btnText.textContent = isLoading
      ? "Registrando empresa…"
      : "Registrar empresa";
  if (btnIcon) btnIcon.style.display = isLoading ? "none" : "flex";
  if (btnSpinner) btnSpinner.style.display = isLoading ? "block" : "none";
}

/**
 * Lee los valores del formulario y ejecuta todas las validaciones.
 * @returns {{ isValid: boolean, payload: object|null }}
 */
function readAndValidateForm() {
  const name = document.getElementById("company-name")?.value ?? "";
  const phone = document.getElementById("company-phone")?.value ?? "";
  const email = document.getElementById("company-email")?.value ?? "";
  const address = document.getElementById("company-address")?.value ?? "";
  const stateProvince = document.getElementById("company-state")?.value ?? "";
  const city = document.getElementById("company-city")?.value ?? "";
  const description =
    document.getElementById("company-description")?.value ?? "";
  const taxId = document.getElementById("company-tax-id")?.value ?? "";
  const websiteUrl = document.getElementById("company-website")?.value ?? "";
  const logoUrl = document.getElementById("company-logo")?.value ?? "";

  let isValid = true;
  clearAllErrors();
  const nameError = Validators.name(name);
  if (nameError) {
    showFieldError("company-name", nameError);
    isValid = false;
  }

  const phoneError = Validators.phone(phone);
  if (phoneError) {
    showFieldError("company-phone", phoneError);
    isValid = false;
  }

  const emailError = Validators.email(email);
  if (emailError) {
    showFieldError("company-email", emailError);
    isValid = false;
  }

  const addressError = Validators.address(address);
  if (addressError) {
    showFieldError("company-address", addressError);
    isValid = false;
  }

  const stateError = Validators.state_province(stateProvince);
  if (stateError) {
    showFieldError("company-state", stateError);
    isValid = false;
  }

  const cityError = Validators.city(city);
  if (cityError) {
    showFieldError("company-city", cityError);
    isValid = false;
  }
  if (websiteUrl.trim()) {
    const websiteError = Validators.url(websiteUrl);
    if (websiteError) {
      showFieldError("company-website", websiteError);
      isValid = false;
    }
  }

  if (logoUrl.trim()) {
    const logoError = Validators.url(logoUrl);
    if (logoError) {
      showFieldError("company-logo", logoError);
      isValid = false;
    }
  }

  if (!isValid) return { isValid: false, payload: null };
  const user = TokenManager.getUser();
  const payload = {
    user_id: user.id,
    name: name.trim(),
    phone: phone.trim(),
    email: email.trim(),
    address: address.trim(),
    state_province: stateProvince.trim(),
    city: city.trim(),
  };

  // Campos opcionales: solo se incluyen si tienen valor
  if (description.trim()) payload.description = description.trim();
  if (taxId.trim()) payload.tax_id = taxId.trim();
  if (websiteUrl.trim()) payload.website_url = websiteUrl.trim();
  if (logoUrl.trim()) payload.logo_url = logoUrl.trim();

  return { isValid: true, payload };
}

/**
 * Interpreta el error de la API y lo presenta al usuario de forma comprensible.
 * @param {Error} err - Error enriquecido con .status y .data
 */
function handleApiError(err) {
  const status = err.status ?? 0;

  if (status === 0) {
    notify.error("Sin conexión al servidor. Verifica tu conexión a internet.");
    return;
  }

  if (status === 400) {
    // Error de validación del servidor — puede tener detalles en err.data
    const detail = err.data?.errors?.[0]?.message ?? err.message;
    notify.error(`Error de validación: ${detail}`);
    return;
  }

  if (status === 401) {
    notify.warning("Tu sesión ha expirado. Inicia sesión de nuevo.");
    return; // TokenManager.logout() ya fue llamado en companyService.request
  }

  if (status === 403) {
    notify.error("No tienes permiso para realizar esta acción.");
    return;
  }

  if (status === 409) {
    // Email de empresa ya registrado
    showFieldError(
      "company-email",
      "Este correo electrónico ya está registrado por otra empresa.",
    );
    notify.error("El correo electrónico ya está en uso por otra empresa.");
    return;
  }

  if (status >= 500) {
    notify.error("Error del servidor. Intenta de nuevo en unos minutos.");
    return;
  }

  notify.error(err.message || "Ocurrió un error inesperado. Intenta de nuevo.");
}

/**
 * Ejecuta la transición de contexto tras crear la empresa exitosamente.
 *
 * El backend emite nuevos JWT en `apiResponse.auth` al crear una empresa,
 * con el rol actualizado ("Empresa"). Este método los persiste inmediatamente
 * via TokenManager antes de redirigir, garantizando que la sesión sea
 * coherente desde el primer request en homeCompany.
 *
 * @param {object} apiResponse - Respuesta completa del API (incluye .data y .auth).
 */
/**
 * Ejecuta la transición de contexto tras crear la empresa exitosamente.
 *
 * El backend emite nuevos JWT en `apiResponse.auth` al crear una empresa,
 * con el rol actualizado ("Empresas"). Este método los persiste inmediatamente
 * vía TokenManager antes de redirigir, garantizando que la sesión sea
 * coherente desde el primer request en homeCompany.
 *
 * @param {object} apiResponse - Respuesta completa del API (incluye .data y .auth).
 */
async function transitionToCompanyContext(apiResponse) {
  const createdCompany = apiResponse.data ?? apiResponse;
  let newTokens = apiResponse.auth ?? null;

  // Si el backend no envió tokens directamente en la respuesta, invocamos upgradeRole
  if (!newTokens?.accessToken) {
    try {
      const upgradedRes = await companyService.upgradeRole();
      if (upgradedRes?.data?.accessToken) {
        newTokens = upgradedRes.data;
      }
    } catch (err) {
      console.warn("[CreateCompany] No se pudo obtener token actualizado vía upgradeRole:", err);
    }
  }

  // Guardar los nuevos JWT con el rol "Empresa"
  if (newTokens?.accessToken) {
    TokenManager.saveToken(newTokens);
    console.info(
      "[CreateCompany] Tokens de sesión actualizados exitosamente al rol:",
      newTokens.role_name ?? "Empresas",
    );
  }

  // Guardar señales de contexto para homeCompany.js
  sessionStorage.setItem("company_just_created", "true");
  sessionStorage.setItem("company_id", createdCompany.id ?? "");

  notify.success("¡Empresa registrada correctamente! Actualizando sesión…");
  setTimeout(() => {
    window.location.href = HOME_COMPANY_PATH;
  }, 1000);
}
function showPageLoading() {
  document
    .getElementById("page-loading-overlay")
    ?.style.removeProperty("display");
  document
    .getElementById("create-company-main-content")
    ?.style.setProperty("display", "none");
}

function showMainContent() {
  const overlay = document.getElementById("page-loading-overlay");
  if (overlay) overlay.style.display = "none";
  document
    .getElementById("create-company-main-content")
    ?.style.removeProperty("display");
}

function showAlreadyRegisteredBlock() {
  const overlay = document.getElementById("page-loading-overlay");
  if (overlay) overlay.style.display = "none";

  document
    .getElementById("create-company-main-content")
    ?.style.setProperty("display", "none");
  const alreadyBlock = document.getElementById("already-registered-block");
  if (alreadyBlock) alreadyBlock.style.removeProperty("display");
}

/**
 * Protección de ruta: verifica si el usuario autenticado puede acceder
 * a createCompany.
 *
 * Reglas:
 *  - Debe estar autenticado.
 *  - Debe tener rol ROLES.USER (cliente/usuario sin empresa) o ROLES.COMPANY.
 *  - Si ya tiene empresa registrada → actualiza rol de sesión y redirige a homeCompany.
 *
 * @returns {Promise<boolean>} true si puede continuar, false si fue redirigido.
 */
async function checkAccessGuard() {
  // 1. Auth guard
  if (!TokenManager.isAuthenticated()) {
    TokenManager.logout();
    return false;
  }

  const user = TokenManager.getUser();

  // 2. Role guard — solo ROLES.USER o ROLES.COMPANY puede llegar aquí
  if (!user || (user.role !== ROLES.USER && user.role !== ROLES.COMPANY)) {
    console.warn("[CreateCompany] Rol no autorizado:", user?.role);
    Router.redirectByRole();
    return false;
  }

  // 3. Si el rol del token ya es COMPANY → redirigir directo a homeCompany
  if (user.role === ROLES.COMPANY) {
    window.location.href = HOME_COMPANY_PATH;
    return false;
  }

  // 4. Verificar vía API si ya tiene empresa registrada (protección real de ruta)
  try {
    showPageLoading();
    const existingCompany = await companyService.getByUserId(user.id);

    if (existingCompany) {
      console.info(
        "[CreateCompany] Usuario ya tiene empresa. Actualizando rol de sesión...",
      );

      // Intentar actualizar el token del usuario a Empresa inmediatamente
      try {
        const upgradedRes = await companyService.upgradeRole();
        if (upgradedRes?.data?.accessToken) {
          TokenManager.saveToken(upgradedRes.data);
          console.info("[CreateCompany] Rol actualizado a Empresa. Redirigiendo...");
          window.location.href = HOME_COMPANY_PATH;
          return false;
        }
      } catch (upgradeErr) {
        console.warn("[CreateCompany] No se pudo actualizar el token:", upgradeErr.message);
      }

      showAlreadyRegisteredBlock();
      return false;
    }
  } catch (err) {
    console.warn(
      "[CreateCompany] No se pudo verificar empresa existente:",
      err.message,
    );
  }

  showMainContent();
  return true;
}

/**
 * Manejador del submit del formulario.
 * @param {Event} e
 */
async function handleFormSubmit(e) {
  e.preventDefault();

  const { isValid, payload } = readAndValidateForm();
  if (!isValid) return;

  setButtonLoading(true);

  try {
    const response = await companyService.create(payload);
    await transitionToCompanyContext(response);
  } catch (err) {
    handleApiError(err);
    setButtonLoading(false);
  }
}

/**
 * Limpia el error de un campo cuando el usuario comienza a escribir.
 * @param {string} fieldId
 */
function bindRealTimeClear(fieldId) {
  const input = document.getElementById(fieldId);
  if (!input) return;
  input.addEventListener("input", () => clearFieldError(fieldId));
}

async function init() {
  const canAccess = await checkAccessGuard();
  if (!canAccess) return;
  const form = document.getElementById("create-company-form");
  form?.addEventListener("submit", handleFormSubmit);
  document
    .getElementById("btn-go-to-company")
    ?.addEventListener("click", async () => {
      try {
        const upgradedRes = await companyService.upgradeRole();
        if (upgradedRes?.data?.accessToken) {
          TokenManager.saveToken(upgradedRes.data);
        }
      } catch (err) {
        console.warn("[CreateCompany] Error al actualizar token:", err);
      }
      window.location.href = HOME_COMPANY_PATH;
    });
  const allFields = [
    "company-name",
    "company-phone",
    "company-email",
    "company-address",
    "company-state",
    "company-city",
    "company-tax-id",
    "company-description",
    "company-website",
    "company-logo",
  ];
  allFields.forEach(bindRealTimeClear);
}

document.addEventListener("DOMContentLoaded", init);
