/**
 * @file pwa.js
 * @description Módulo de registro del Service Worker y gestión de conectividad PWA para ProveeLink.
 */

import { notify } from './services/notificationService.js';

let deferredInstallPrompt = null;

/**
 * Registra el Service Worker en la aplicación.
 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[PWA] El navegador no soporta Service Workers.');
    return;
  }

  window.addEventListener('load', async () => {
    try {
      // Determinamos el path relativo según la ubicación actual
      const swPath = window.location.pathname.includes('/pages/') ? '../../sw.js' : './sw.js';
      
      const registration = await navigator.serviceWorker.register(swPath, {
        scope: './'
      });

      console.log('[PWA] Service Worker registrado con éxito. Scope:', registration.scope);

      // Detectar actualizaciones disponibles
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            notify.info('Nueva versión disponible. Recarga para actualizar.', 6000);
          }
        });
      });
    } catch (error) {
      console.error('[PWA] Error al registrar el Service Worker:', error);
    }
  });
}

/**
 * Inicializa detectores de conectividad (Online/Offline).
 */
export function initConnectivityListeners() {
  window.addEventListener('online', () => {
    console.info('[PWA] Conexión restablecida.');
    notify.success('Conexión a internet restablecida.', 4000);
    document.body.classList.remove('is-offline');
  });

  window.addEventListener('offline', () => {
    console.warn('[PWA] Modo offline activado.');
    notify.warning('Modo sin conexión. Usando datos e imágenes en caché.', 6000);
    document.body.classList.add('is-offline');
  });

  // Estado inicial
  if (!navigator.onLine) {
    document.body.classList.add('is-offline');
  }
}

/**
 * Captura el evento de instalación PWA para uso futuro.
 */
export function initInstallPromptListener() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    console.log('[PWA] Evento beforeinstallprompt capturado. PWA lista para instalar.');
    
    // Disparar evento personalizado si la UI desea mostrar un botón de instalación
    window.dispatchEvent(new CustomEvent('pwaCanInstall', { detail: { prompt: deferredInstallPrompt } }));
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    console.log('[PWA] ProveeLink fue instalada exitosamente.');
    notify.success('¡Gracias por instalar ProveeLink en tu dispositivo!');
  });
}

/**
 * Dispara el prompt de instalación de la PWA si está disponible.
 * @returns {Promise<boolean>} True si el usuario aceptó instalar.
 */
export async function promptPWAInstall() {
  if (!deferredInstallPrompt) {
    console.warn('[PWA] El prompt de instalación no está disponible aún.');
    return false;
  }
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  return outcome === 'accepted';
}

/**
 * Actualiza dinámicamente el favicon del documento.
 * @param {string} iconPath - Ruta relativa o absoluta al icono (.ico / .png)
 */
export function setFavicon(iconPath) {
  let link = document.querySelector("link[rel*='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.type = iconPath.endsWith('.ico') ? 'image/x-icon' : 'image/png';
  link.href = iconPath;
}

// Auto-inicialización al importar
registerServiceWorker();
initConnectivityListeners();
initInstallPromptListener();
