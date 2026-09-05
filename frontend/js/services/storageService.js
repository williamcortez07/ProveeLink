/**
 * @file storageService.js
 * @description Servicio de subida de archivos a Supabase Storage.
 *
 * Responsabilidades (SRP):
 *  - Validar tipo y tamaño del archivo antes de subir.
 *  - Generar un path único por entidad para evitar colisiones.
 *  - Subir el archivo al bucket correspondiente.
 *  - Retornar la URL pública resultante.
 */

import { supabase } from "./supabase.js";

// ─── Constantes ───────────────────────────────────────────────────────────────

const PROFILE_BUCKET = "userPhotos";
const PRODUCT_BUCKET = "products";
const MAX_SIZE_MB = 5;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// ─── Helpers privados ─────────────────────────────────────────────────────────

/**
 * Valida el archivo antes de subirlo.
 * @param {File} file
 * @throws {Error} Si el tipo o el tamaño no son válidos.
 */
function validateFile(file) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(
      "Formato no permitido. Solo se aceptan imágenes JPG, PNG, WEBP o GIF.",
    );
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(
      `La imagen "${file.name}" supera el límite de ${MAX_SIZE_MB} MB.`,
    );
  }
}

/**
 * Construye el path dentro del bucket.
 * Estructura: {entityId}/{timestamp}_{random}.{ext}
 *
 * @param {string} entityId - ID del propietario (usuario o proveedor).
 * @param {File}   file
 * @returns {string}
 */
function buildFilePath(entityId, file) {
  const ext = file.name.split(".").pop().toLowerCase() || "jpg";
  const sanitized = String(entityId || "common").replace(/[^a-zA-Z0-9\-]/g, "");
  const randomSuffix = Math.random().toString(36).substring(2, 7);
  return `${sanitized}/${Date.now()}_${randomSuffix}.${ext}`;
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Sube una imagen de perfil al bucket "userPhotos" de Supabase Storage.
 * @param {File}   file   - Archivo de imagen.
 * @param {string} userId - ID del usuario autenticado (carpeta organizativa).
 * @returns {Promise<string>} URL pública permanente.
 */
export async function uploadProfilePicture(file, userId) {
  validateFile(file);
  const filePath = buildFilePath(userId, file);

  const { error: uploadError } = await supabase.storage
    .from(PROFILE_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) {
    throw new Error(`Error al subir foto de perfil: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from(PROFILE_BUCKET).getPublicUrl(filePath);
  if (!data?.publicUrl) {
    throw new Error("No se pudo obtener la URL pública de la foto de perfil.");
  }

  return data.publicUrl;
}

/**
 * Sube UNA imagen de producto al bucket "products" de Supabase Storage.
 *
 * @param {File}   file     - Archivo de imagen.
 * @param {string} ownerId  - ID del usuario o proveedor (para organizar carpetas).
 * @returns {Promise<string>} URL pública permanente.
 */
export async function uploadProductImage(file, ownerId) {
  validateFile(file);

  const filePath = buildFilePath(ownerId, file);

  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) {
    console.error(
      "[storageService] Error al subir imagen de producto:",
      uploadError,
    );

    if (
      uploadError.message?.includes("row-level security") ||
      uploadError.message?.includes("policy")
    ) {
      throw new Error(
        "No tienes permisos para subir imágenes. Verifica la configuración del bucket en Supabase (política RLS de INSERT para anon).",
      );
    }
    if (uploadError.message?.includes("signature")) {
      throw new Error(
        "Error de autenticación con el servicio de almacenamiento. Recarga la página e inténtalo nuevamente.",
      );
    }
    throw new Error(`Error al subir la imagen: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from(PRODUCT_BUCKET).getPublicUrl(filePath);
  if (!data?.publicUrl) {
    throw new Error(
      "No se pudo obtener la URL pública de la imagen del producto.",
    );
  }

  return data.publicUrl;
}

export async function uploadMultipleProductImages(files, ownerId, onProgress) {
  const urls = [];
  const errors = [];

  for (const file of files) {
    try {
      const url = await uploadProductImage(file, ownerId);
      urls.push(url);
      onProgress?.(urls.length, files.length, url);
    } catch (error) {
      errors.push({
        file: file.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { urls, errors };
}

/**
 * Sube MÚLTIPLES imágenes de producto de forma SECUENCIAL a Supabase Storage.
 *
 * Se usa secuencial (no Promise.all) para:
 *  1. Evitar estados inconsistentes: si falla una, ya se sabe cuántas se subieron.
 *  2. Evitar saturación de conexiones en uploads simultáneos.
 *  3. Poder reportar progreso archivo por archivo.
 *
 * @param {File[]}   files      - Lista de archivos a subir.
 * @param {string}   ownerId    - ID del usuario o proveedor.
 * @param {Function} [onProgress] - Callback opcional: (uploaded, total, url) => void
 * @returns {Promise<{urls: string[], errors: {file: string, error: string}[]}>}
 */
export async function uploadVerificationEvidence(file, requestId) {
  validateFile(file);
  const filePath = buildFilePath(requestId, file);
  const VERIFICATION_BUCKET = "verification";

  let { error: uploadError } = await supabase.storage
    .from(VERIFICATION_BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    });

  // Fallback al bucket 'products' si 'verification' no existe aún
  let targetBucket = VERIFICATION_BUCKET;
  if (
    uploadError &&
    (uploadError.message?.includes("not found") ||
      uploadError.message?.includes("Bucket"))
  ) {
    console.warn(
      "[storageService] Bucket 'verification' no encontrado, usando 'products' como fallback.",
    );
    targetBucket = PRODUCT_BUCKET;
    const { error: fallbackErr } = await supabase.storage
      .from(targetBucket)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type,
      });
    uploadError = fallbackErr;
  }

  if (uploadError) {
    throw new Error(`Error al subir evidencia: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from(targetBucket).getPublicUrl(filePath);
  if (!data?.publicUrl) {
    throw new Error("No se pudo obtener la URL pública de la evidencia.");
  }

  return data.publicUrl;
}
