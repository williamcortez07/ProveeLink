import { homeApi } from "./services/api.js";

function createCategoryCard(cat) {
  const a = document.createElement("a");
  a.className = "category-card";
  a.href = `../pages/categoryInfo.html?id=${encodeURIComponent(cat.id)}`;

  const iconSpan = document.createElement("span");
  iconSpan.className = "category-icon";

  const img = document.createElement("img");
  img.alt = cat.name || "categoría";
  img.loading = "lazy";
  if (cat.icon_url) img.src = cat.icon_url;
  img.addEventListener("error", () => {
    img.style.display = "none";
  });

  iconSpan.appendChild(img);

  const label = document.createElement("span");
  label.className = "category-label";
  label.textContent = cat.name || "";

  a.appendChild(iconSpan);
  a.appendChild(label);
  return a;
}

async function loadCategories() {
  const container = document.getElementById("categoriesGrid");
  if (!container) return;

  // Indicador simple de carga
  container.innerHTML = "<p>Cargando categorías...</p>";

  try {
    const res = await homeApi.getCategories();
    const items = res?.data ?? [];

    container.innerHTML = "";
    if (!items.length) {
      container.innerHTML = "<p>No hay categorías disponibles.</p>";
      return;
    }

    items.forEach((c) => {
      const card = createCategoryCard(c);
      container.appendChild(card);
    });
  } catch (err) {
    console.error("Error cargando categorías", err);
    container.innerHTML = "<p>No se pudieron cargar las categorías.</p>";
  }
}

document.addEventListener("DOMContentLoaded", loadCategories);
