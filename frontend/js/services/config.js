/**
 * @file config.js
 * @description Configuración centralizada de la URL base de la API.
 * Detecta automáticamente si el entorno es desarrollo local (localhost / 127.0.0.1)
 * o producción (Vercel / dominio remoto).
 */

const isLocal =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

export const API_BASE_URL = isLocal
  ? "http://localhost:3000/api/v1"
  : "https://proveelink-1.onrender.com/api/v1";
