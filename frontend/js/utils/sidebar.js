/**
 * @file sidebar.js
 * @description Gestor del componente Sidebar (menú lateral).
 *
 * Carga e inyecta dinámicamente el sidebar en cualquier vista.
 * Basta con incluir <div id="sidebar-target"></div> en el HTML de la vista.
 */

const SIDEBAR_SELECTOR = "#sidebar-target";

/**
 * Calcula la ruta al fragmento de componente de forma absoluta.
 * Siempre apunta a /pages/components/ para evitar inconsistencias de rutas relativas.
 * @param {string} filename - Nombre del archivo HTML del componente.
 * @returns {string} URL absoluta al componente.
 */
function resolveComponentPath(filename) {
  return `/pages/components/${filename}`;
}

async function loadSidebar() {
  const target = document.querySelector(SIDEBAR_SELECTOR);
  if (!target) return;

  try {
    // Parámetro de versionado para prevenir almacenamiento en caché antiguo
    const response = await fetch(`${resolveComponentPath("sidebar.html")}?v=${Date.now()}`);
    if (!response.ok)
      throw new Error(`Error cargando sidebar: ${response.status}`);
    target.innerHTML = await response.text();
    initSidebarMenu();
  } catch (error) {
    console.error("Error al cargar el fragmento de sidebar:", error);
  }
}

function getAppLayout() {
  return document.querySelector(".app-layout");
}

function openSidebar() {
  const appLayout = getAppLayout();
  if (!appLayout) return;

  appLayout.classList.add("sidebar-mobile-open");
  const menuBtn = document.getElementById("menuToggle");
  if (menuBtn) menuBtn.setAttribute("aria-expanded", "true");
}

function closeSidebar() {
  const appLayout = getAppLayout();
  if (!appLayout) return;

  appLayout.classList.remove("sidebar-mobile-open");
  const menuBtn = document.getElementById("menuToggle");
  if (menuBtn) menuBtn.setAttribute("aria-expanded", "false");
}

function toggleSidebar() {
  const appLayout = getAppLayout();
  if (!appLayout) return;

  if (appLayout.classList.contains("sidebar-mobile-open")) {
    closeSidebar();
  } else {
    openSidebar();
  }
}

function setActiveSidebarLink() {
  const currentPath = window.location.pathname;
  const links = document.querySelectorAll(".sidebar-nav-link[data-nav-route]");

  links.forEach((link) => {
    const route = link.getAttribute("data-nav-route");
    const isActive =
      route && (currentPath.endsWith(route) || currentPath === route);
    link.classList.toggle("is-active", Boolean(isActive));
    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

function initSidebarMenu() {
  setActiveSidebarLink();

  const sidebar = document.querySelector(".main-sidebar");
  const closeBtn = document.getElementById("sidebarCloseBtn");
  const backdrop = document.getElementById("sidebarBackdrop");

  // Botón "X" de cierre
  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeSidebar();
    });
  }

  // Backdrop overlay para cerrar en móvil
  if (backdrop) {
    backdrop.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeSidebar();
    });
  }

  // Tecla Escape para cerrar
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSidebar();
  });

  // Cerrar panel al navegar
  if (sidebar) {
    sidebar.querySelectorAll(".sidebar-nav-link").forEach((link) => {
      link.addEventListener("click", closeSidebar);
    });
  }
}

// Clic fuera del sidebar para cerrar en móvil (evaluado dinámicamente)
document.addEventListener("click", (event) => {
  const appLayout = getAppLayout();
  if (!appLayout || !appLayout.classList.contains("sidebar-mobile-open"))
    return;

  const sidebar = document.querySelector(".main-sidebar");
  const menuBtn = document.getElementById("menuToggle");

  if (sidebar && sidebar.contains(event.target)) return;
  if (menuBtn && (menuBtn === event.target || menuBtn.contains(event.target))) return;

  closeSidebar();
});

// Escuchar evento emitido desde navbar.js
document.addEventListener("navbar:toggle-sidebar", (e) => {
  e.stopPropagation();
  toggleSidebar();
});

// API Global
window.SidebarManager = {
  open: openSidebar,
  close: closeSidebar,
  toggle: toggleSidebar,
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadSidebar);
} else {
  loadSidebar();
}
