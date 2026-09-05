/**
 * @file verifiedBadge.js
 * @description Componente reutilizable para el badge de proveedor verificado.
 *
 * Usa el campo `verification_status` o `is_verified` que retorna la API
 * de proveedores (GET /api/v1/suppliers y derivados).
 *
 * Uso:
 *   import { buildVerifiedBadge } from "../utils/verifiedBadge.js";
 *   html += buildVerifiedBadge(supplier.verification_status);
 *   // o también:
 *   html += buildVerifiedBadge(supplier.is_verified ? "verified" : "pending");
 */

/**
 * Genera el HTML del badge de verificación de un proveedor.
 *
 * @param {string|boolean|null|undefined} verificationStatus
 *   Acepta:
 *   - string: "verified" | "pending" | "rejected" | cualquier otro valor
 *   - boolean: true → verified, false → not verified
 *   - null/undefined → no verificado
 * @param {"default"|"compact"|"inline"} [variant="default"]
 *   - "default"  → badge completo con icono y texto
 *   - "compact"  → solo el ícono de check (para tarjetas pequeñas)
 *   - "inline"   → badge en línea sin fondo (para uso dentro de encabezados)
 * @returns {string} HTML del badge
 */
export function buildVerifiedBadge(verificationStatus, variant = "default") {
  // Normalizar a boolean
  const isVerified =
    verificationStatus === "verified" ||
    verificationStatus === true ||
    verificationStatus === "true";

  if (isVerified) {
    const checkIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"
        aria-hidden="true">
        <polyline points="20 6 9 17 4 12"/>
      </svg>`;

    if (variant === "compact") {
      return `<span class="badge-verified badge-verified--compact" title="Proveedor verificado" aria-label="Proveedor verificado">
        ${checkIcon}
      </span>`;
    }

    if (variant === "inline") {
      return `<span class="badge-verified badge-verified--inline" aria-label="Proveedor verificado">
        ${checkIcon}
        <span>Verificado</span>
      </span>`;
    }

    // default
    return `<span class="badge-verified" role="img" aria-label="Proveedor verificado">
      ${checkIcon}
      <span>Verificado</span>
    </span>`;
  }

  // No verificado
  if (variant === "compact") {
    return `<span class="badge-unverified badge-unverified--compact" title="No verificado" aria-label="No verificado">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2.5" aria-hidden="true">
        <circle cx="12" cy="12" r="9"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    </span>`;
  }

  return `<span class="badge-unverified" role="img" aria-label="No verificado">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2.5" aria-hidden="true">
      <circle cx="12" cy="12" r="9"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
    <span>No verificado</span>
  </span>`;
}
