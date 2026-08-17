/**
 * @file sidebar.js
 * @description Gestor del componente Sidebar (menú lateral).
 *
 * Carga e inyecta dinámicamente el sidebar en cualquier vista.
 * Basta con incluir <div id="sidebar-target"></div> en el HTML de la vista.
 */

const SIDEBAR_SELECTOR = "#sidebar-target";

/**
 * Calcula la ruta al fragmento de componente de forma dinámica.
 * Funciona desde cualquier profundidad de directorio (pages/X.html, pages/sub/X.html…).
 * Busca el segmento '/pages/' en la URL actual y construye el path a 'components/'.
 * @param {string} filename - Nombre del archivo HTML del componente.
 * @returns {string} URL absoluta al componente.
 */
function resolveComponentPath(filename) {
  const path = window.location.pathname;
  const marker = "/pages/";
  const idx = path.indexOf(marker);
  if (idx !== -1) {
    return path.substring(0, idx + marker.length) + "components/" + filename;
  }
  // Fallback: asumir que estamos en la raíz del frontend (index.html)
  return "./pages/components/" + filename;
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
  const menuBtn = document.getElementById("menuToggle");
  if (!appLayout) return;

  appLayout.classList.add("sidebar-mobile-open");
  if (menuBtn) menuBtn.setAttribute("aria-expanded", "true");
}

function closeSidebar() {
  const appLayout = getAppLayout();
  const menuBtn = document.getElementById("menuToggle");
  if (!appLayout) return;

  appLayout.classList.remove("sidebar-mobile-open");
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

  const appLayout = getAppLayout();
  const sidebar = document.querySelector(".main-sidebar");
  const closeBtn = document.getElementById("sidebarCloseBtn");
  const backdrop = document.getElementById("sidebarBackdrop");
  const menuBtn = document.getElementById("menuToggle");

  // Botón "X" de cierre
  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeSidebar();
    });
  }

  // Backdrop overlay para cerrar en móvil
  if (backdrop) {
    backdrop.addEventListener("click", (e) => {
      e.stopPropagation();
      closeSidebar();
    });
  }

  // Evento directo al botón de menú hamburguesa si ya está presente
  if (menuBtn) {
    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleSidebar();
    });
  }

  // Clic fuera del sidebar para cerrar en móvil
  document.addEventListener("click", (event) => {
    if (!appLayout || !appLayout.classList.contains("sidebar-mobile-open"))
      return;
    if (
      sidebar &&
      !sidebar.contains(event.target) &&
      (!menuBtn || !menuBtn.contains(event.target))
    ) {
      closeSidebar();
    }
  });

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

// Escuchar evento emitido desde navbar.js
document.addEventListener("navbar:toggle-sidebar", toggleSidebar);

// API Global
window.SidebarManager = {
  open: openSidebar,
  close: closeSidebar,
  toggle: toggleSidebar,
};

document.addEventListener("DOMContentLoaded", loadSidebar);
