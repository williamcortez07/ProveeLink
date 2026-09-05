/**
 * @file sw.js
 * @description Service Worker principal de ProveeLink PWA.
 * Gestiona el caché offline de App Shell, imágenes de Supabase Storage,
 * respuestas de API REST y fallback vectorial SVG para imágenes cuando no hay internet.
 */

const CACHE_VERSION = "v1";
const STATIC_CACHE_NAME = `proveelink-static-${CACHE_VERSION}`;
const IMAGE_CACHE_NAME = `proveelink-images-${CACHE_VERSION}`;
const DATA_CACHE_NAME = `proveelink-data-${CACHE_VERSION}`;

const OFFLINE_IMAGE_URL = "./assets/icons/offline-placeholder.svg";

const APP_SHELL_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/base/globals.css",
  "./css/components/sidebar.css",
  "./css/components/login.css",
  "./js/auth.js",
  "./js/pwa.js",
  OFFLINE_IMAGE_URL,
  "./assets/icons/baner.ico",
  "./assets/icons/baner.png",
  "./assets/icons/proteger.ico",
];

self.addEventListener("install", (event) => {
  console.log("[Service Worker] Instalando Service Worker v1...");
  event.waitUntil(
    caches
      .open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log(
          "[Service Worker] Pre-cacheando App Shell y assets estáticos...",
        );
        return cache.addAll(APP_SHELL_ASSETS);
      })
      .then(() => {
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error("[Service Worker] Error durante precaché:", err);
      }),
  );
});

self.addEventListener("activate", (event) => {
  console.log("[Service Worker] Activando Service Worker...");
  const currentCaches = [STATIC_CACHE_NAME, IMAGE_CACHE_NAME, DATA_CACHE_NAME];
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!currentCaches.includes(cacheName)) {
              console.log(
                "[Service Worker] Eliminando caché obsoleta:",
                cacheName,
              );
              return caches.delete(cacheName);
            }
          }),
        );
      })
      .then(() => {
        return self.clients.claim();
      }),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET") {
    return;
  }
  const isImageRequest =
    request.destination === "image" ||
    url.pathname.match(/\.(png|jpg|jpeg|webp|gif|svg)(\?.*)?$/i) ||
    url.pathname.includes("/storage/v1/object/public/") ||
    (url.hostname.includes("supabase.co") && url.pathname.includes("storage"));

  if (isImageRequest) {
    event.respondWith(handleImageFetch(request));
    return;
  }

  const isApiRequest =
    url.pathname.includes("/rest/v1/") ||
    url.pathname.includes("/api/v1/") ||
    url.hostname.includes("supabase.co");

  if (isApiRequest) {
    event.respondWith(handleApiFetch(request));
    return;
  }
  event.respondWith(handleAppShellFetch(request));
});

// ─────────────────────────────────────────────────────────────────────────────
// ESTRATEGIAS DE CACHÉ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maneja peticiones de imágenes (Supabase Storage / Unsplash / Locales).
 * Estrategia: Cache-First con actualización en segundo plano (Stale-While-Revalidate)
 * Si falla la red y NO existe en caché -> Retorna SVG Offline Placeholder.
 */
async function handleImageFetch(request) {
  const cache = await caches.open(IMAGE_CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    // Revalidación en segundo plano si hay red
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          cache.put(request, networkResponse.clone());
        }
      })
      .catch(() => {
        /* Silencioso offline */
      });
    return cachedResponse;
  }

  // Si no está en caché, intentar traerlo de la red
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.warn("[Service Worker] Imagen no accesible offline:", request.url);
    const staticCache = await caches.open(STATIC_CACHE_NAME);
    const offlineFallback = await staticCache.match(OFFLINE_IMAGE_URL);
    if (offlineFallback) {
      return offlineFallback;
    }

    return new Response(
      `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150">
        <rect width="100%" height="100%" fill="#f1f5f9"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#64748b" font-family="sans-serif" font-size="12">Imagen Offline</text>
      </svg>`,
      { headers: { "Content-Type": "image/svg+xml" } },
    );
  }
}

async function handleApiFetch(request) {
  const cache = await caches.open(DATA_CACHE_NAME);
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log(
      "[Service Worker] Sirviendo datos de la API desde caché (offline)...",
    );
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    // Si no hay respuesta previa en caché
    return new Response(
      JSON.stringify({
        error: "offline",
        message: "No hay conexión a internet y no hay datos cacheados.",
      }),
      { status: 533, headers: { "Content-Type": "application/json" } },
    );
  }
}

async function handleAppShellFetch(request) {
  const cache = await caches.open(STATIC_CACHE_NAME);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse && networkResponse.status === 200) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => {
      /* Silencioso en modo offline */
    });

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetchPromise;
    if (networkResponse) return networkResponse;
  } catch (err) {
    // Si es navegación HTML y falla la red, servir index.html
    if (
      request.mode === "navigate" ||
      request.headers.get("accept")?.includes("text/html")
    ) {
      const appShell = await cache.match("./index.html");
      if (appShell) return appShell;
    }
  }

  return cachedResponse || fetchPromise;
}
