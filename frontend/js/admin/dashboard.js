/**
 * @file dashboard.js
 * @description Lógica del dashboard administrativo.
 * Obtiene KPIs de /api/v1/admin/stats y renderiza gráficos responsivos con Chart.js
 * con soporte para actualización dinámica entre Light Mode y Dark Mode.
 */

import {
  requireAdminAuth,
  fillSidebarUser,
  initSidebarToggle,
  admToast,
} from "./adminAuth.js";
import { statsApi } from "./adminApi.js";

let adminUser;
try {
  adminUser = requireAdminAuth();
} catch {}

fillSidebarUser(adminUser);
initSidebarToggle();
const topbarDate = document.getElementById("topbarDate");
if (topbarDate) {
  topbarDate.textContent = new Date().toLocaleDateString("es", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
let lastStatsData = null;

function getChartColors() {
  const theme = document.documentElement.getAttribute("data-theme") || "light";
  const isDark = theme === "dark";
  return {
    textColor: isDark ? "#8899b4" : "#475569",
    gridColor: isDark ? "rgba(99,120,172,0.12)" : "rgba(148,163,184,0.18)",
    doughnutBorder: isDark ? "#1e2a42" : "#ffffff",
  };
}

function applyChartDefaults() {
  if (!window.Chart) return;
  const colors = getChartColors();
  Chart.defaults.color = colors.textColor;
  Chart.defaults.borderColor = colors.gridColor;
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size = 12;
}

applyChartDefaults();

// Escuchar cambios de tema para re-renderizar gráficos con la nueva paleta de colores
window.addEventListener("admin:theme-changed", () => {
  applyChartDefaults();
  if (lastStatsData) {
    if (lastStatsData.users_by_month)
      renderUsersChart(lastStatsData.users_by_month);
    if (lastStatsData.suppliers_by_status)
      renderSuppliersChart(lastStatsData.suppliers_by_status);
    if (lastStatsData.categories_distribution)
      renderCategoriesChart(lastStatsData.categories_distribution);
  }
});

const KPI_DEFINITIONS = [
  {
    label: "Total Usuarios",
    valueKey: "total_users",
    subKey: "active_users",
    subLabel: "activos",
    gradient: "var(--adm-grad-users)",
    iconBg: "rgba(99,102,241,0.15)",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--adm-accent)"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  },
  {
    label: "Proveedores Verificados",
    valueKey: "verified_companies",
    subKey: "total_companies",
    subLabel: "empresas totales",
    gradient: "var(--adm-grad-vendors)",
    iconBg: "rgba(14,165,233,0.15)",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#0ea5e9"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  },
  {
    label: "Categorías Activas",
    valueKey: "active_categories",
    subKey: "total_categories",
    subLabel: "categorías totales",
    gradient: "var(--adm-grad-cats)",
    iconBg: "rgba(245,158,11,0.15)",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--adm-warning)"><path d="M4 6h16M4 12h16M4 18h7"/></svg>`,
  },
  {
    label: "Solicitudes Pendientes",
    valueKey: "pending_verifications",
    subKey: null,
    subLabel: "requieren revisión",
    gradient: "var(--adm-grad-verify)",
    iconBg: "rgba(239,68,68,0.15)",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--adm-danger)"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  },
];

function renderKpiCards(stats) {
  const grid = document.getElementById("kpiGrid");
  if (!grid) return;
  grid.innerHTML = KPI_DEFINITIONS.map((kpi) => {
    const value = stats[kpi.valueKey] ?? 0;
    const sub = kpi.subKey
      ? `${stats[kpi.subKey] ?? 0} ${kpi.subLabel}`
      : kpi.subLabel;
    return `
      <div class="adm-kpi-card" style="--kpi-gradient:${kpi.gradient};--kpi-icon-bg:${kpi.iconBg}">
        <div class="adm-kpi-card__icon">${kpi.icon}</div>
        <div class="adm-kpi-card__body">
          <div class="adm-kpi-card__label">${kpi.label}</div>
          <div class="adm-kpi-card__value">${Number(value).toLocaleString("es")}</div>
          <div class="adm-kpi-card__sub">${sub}</div>
        </div>
      </div>
    `;
  }).join("");

  const badge = document.getElementById("pendingBadge");
  const pending = Number(stats.pending_verifications ?? 0);
  if (badge && pending > 0) {
    badge.textContent = pending;
    badge.style.display = "inline-flex";
  }
}

let usersChartInstance = null;
let suppliersChartInstance = null;
let categoriesChartInstance = null;

function renderUsersChart(usersByMonth) {
  const ctx = document.getElementById("usersChart")?.getContext("2d");
  if (!ctx || !usersByMonth?.length) return;

  const colors = getChartColors();
  const labels = usersByMonth.map((r) => r.month);
  const data = usersByMonth.map((r) => Number(r.count));

  if (usersChartInstance) usersChartInstance.destroy();
  usersChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Nuevos usuarios",
          data,
          borderColor: "#6366f1",
          backgroundColor: "rgba(99,102,241,0.12)",
          borderWidth: 2.5,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: "#6366f1",
          pointRadius: 4,
          pointHoverRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { color: colors.gridColor },
          ticks: { color: colors.textColor },
        },
        y: {
          beginAtZero: true,
          grid: { color: colors.gridColor },
          ticks: { precision: 0, color: colors.textColor },
        },
      },
    },
  });
}

function renderSuppliersChart(suppliersByStatus) {
  const ctx = document.getElementById("suppliersChart")?.getContext("2d");
  if (!ctx || !suppliersByStatus?.length) return;

  const colors = getChartColors();
  const STATUS_COLORS = {
    active: "#16a34a",
    inactive: "#64748b",
    suspended: "#d97706",
  };
  const STATUS_LABELS = {
    active: "Activos",
    inactive: "Inactivos",
    suspended: "Suspendidos",
  };

  const labels = suppliersByStatus.map(
    (r) => STATUS_LABELS[r.status] ?? r.status,
  );
  const data = suppliersByStatus.map((r) => Number(r.count));
  const bgColors = suppliersByStatus.map(
    (r) => STATUS_COLORS[r.status] ?? "#6366f1",
  );

  if (suppliersChartInstance) suppliersChartInstance.destroy();
  suppliersChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: bgColors,
          borderWidth: 2,
          borderColor: colors.doughnutBorder,
          hoverOffset: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            padding: 16,
            usePointStyle: true,
            pointStyleWidth: 10,
            color: colors.textColor,
          },
        },
      },
      cutout: "65%",
    },
  });
}

function renderCategoriesChart(catsData) {
  const ctx = document.getElementById("categoriesChart")?.getContext("2d");
  if (!ctx || !catsData?.length) return;

  const colors = getChartColors();
  const labels = catsData.map((r) => r.name);
  const data = catsData.map((r) => Number(r.product_count));

  const palette = [
    "#6366f1",
    "#0ea5e9",
    "#16a34a",
    "#d97706",
    "#dc2626",
    "#a855f7",
    "#14b8a6",
    "#f97316",
  ];

  if (categoriesChartInstance) categoriesChartInstance.destroy();
  categoriesChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Productos",
          data,
          backgroundColor: data.map(
            (_, i) => palette[i % palette.length] + "cc",
          ),
          borderColor: data.map((_, i) => palette[i % palette.length]),
          borderWidth: 1.5,
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: colors.textColor } },
        y: {
          beginAtZero: true,
          grid: { color: colors.gridColor },
          ticks: { precision: 0, color: colors.textColor },
        },
      },
    },
  });
}

async function init() {
  try {
    const res = await statsApi.getStats();
    const stats = res.data ?? res;
    lastStatsData = stats;

    renderKpiCards(stats);

    if (window.Chart) {
      renderUsersChart(stats.users_by_month);
      renderSuppliersChart(stats.suppliers_by_status);
      renderCategoriesChart(stats.categories_distribution);
    }
  } catch (err) {
    admToast.error(
      "No se pudieron cargar las estadísticas: " +
        (err.message || "Error desconocido"),
    );
    const grid = document.getElementById("kpiGrid");
    if (grid)
      grid.innerHTML = `<div class="adm-empty" style="grid-column:1/-1"><p class="adm-empty__title">Sin datos disponibles</p></div>`;
  }
}

document.addEventListener("DOMContentLoaded", init);
