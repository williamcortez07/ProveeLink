/**
 * @file footer.js
 * @description Gestor del componente Footer.
 *
 * Carga e inyecta dinámicamente el footer en cualquier vista.
 * Basta con incluir <div id="footer-target"></div> en el HTML
 * de la vista y cargar este script — no requiere llamada manual.
 */

const FOOTER_SELECTOR = "#footer-target";
const BACK_TO_TOP_SCROLL_THRESHOLD = 240;

/**
 * Calcula la ruta al fragmento de componente de forma absoluta.
 * Siempre apunta a /pages/components/ para evitar inconsistencias de rutas relativas.
 * @param {string} filename
 * @returns {string}
 */
function resolveComponentPath(filename) {
  return `/pages/components/${filename}`;
}

async function loadFooter() {
  const target = document.querySelector(FOOTER_SELECTOR);
  if (!target) return;

  try {
    const response = await fetch(resolveComponentPath("footer.html"));
    if (!response.ok)
      throw new Error(`Error cargando footer: ${response.status}`);
    target.innerHTML = await response.text();
    initFooter();
  } catch (error) {
    console.error(error);
  }
}

function setCurrentYear() {
  const yearEl = document.getElementById("footerYear");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
}

function bindBackToTop() {
  const btn = document.getElementById("backToTopBtn");
  if (!btn) return;

  const updateVisibility = () => {
    btn.classList.toggle(
      "is-visible",
      window.scrollY > BACK_TO_TOP_SCROLL_THRESHOLD,
    );
  };

  window.addEventListener("scroll", updateVisibility, { passive: true });
  updateVisibility();

  btn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function initFooter() {
  setCurrentYear();
  bindBackToTop();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadFooter);
} else {
  loadFooter();
}
