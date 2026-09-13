/**
 * @file navbar.js
 * @description Gestor del componente Navbar (header principal).
 */

const NAVBAR_SELECTOR = "#navbar-target";

/**
 * Calcula la ruta al fragmento de componente de forma absoluta.
 * Siempre apunta a /pages/components/ para evitar inconsistencias de rutas relativas.
 * @param {string} filename
 * @returns {string}
 */
function resolveComponentPath(filename) {
  return `/pages/components/${filename}`;
}

async function loadNavbar() {
  const target = document.querySelector(NAVBAR_SELECTOR);
  if (!target) return;

  try {
    const response = await fetch(`${resolveComponentPath("navbar.html")}?v=${Date.now()}`);
    if (!response.ok)
      throw new Error(`Error cargando navbar: ${response.status}`);
    target.innerHTML = await response.text();
    initNavbar();
  } catch (error) {
    console.error(error);
  }
}

function initNavbar() {
  setActiveNavLink();
  bindScrollShadow();
  bindMenuToggle();
}

function setActiveNavLink() {
  const currentPath = window.location.pathname;
  const links = document.querySelectorAll(".main-nav-link[data-nav-route]");

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

function bindScrollShadow() {
  const header = document.getElementById("siteHeader");
  if (!header) return;

  const updateShadow = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 4);
  };

  window.addEventListener("scroll", updateShadow, { passive: true });
  updateShadow();
}

function bindMenuToggle() {
  const btn = document.getElementById("menuToggle");
  if (!btn) return;

  btn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (
      window.SidebarManager &&
      typeof window.SidebarManager.toggle === "function"
    ) {
      window.SidebarManager.toggle();
    } else {
      document.dispatchEvent(new CustomEvent("navbar:toggle-sidebar"));
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadNavbar);
} else {
  loadNavbar();
}
