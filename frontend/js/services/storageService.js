/**
 * @file storageService.js
 * @description Servicio de subida de archivos a Supabase Storage.
 *
 * Responsabilidades (SRP):
 *  - Validar tipo y tamaño del archivo antes de subir.
 *  - Generar un path único por usuario para evitar colisiones.
 *  - Subir el archivo al bucket "userPhotos" con upsert.
 *  - Retornar la URL pública resultante.
 *
 * Políticas RLS recomendadas en el Panel de Supabase para el bucket "userPhotos":
 *  - SELECT (lectura pública): `true`
 *  - INSERT (subida autenticada): `auth.uid()::text = (storage.foldername(name))[1]`
 *  - UPDATE/DELETE: misma condición que INSERT
 */

import { supabase } from "./supabase.js";

// ─── Constantes ───────────────────────────────────────────────────────────────

const BUCKET = "userPhotos";
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
    throw new Error(`La imagen no debe superar ${MAX_SIZE_MB} MB.`);
  }
}

/**
 * Construye el path dentro del bucket.
 * Estructura: {userId}/{timestamp}.{ext}
 * Esto permite que las políticas RLS validen por carpeta (storage.foldername).
 *
 * @param {string} userId
 * @param {File}   file
 * @returns {string}
 */
function buildFilePath(userId, file) {
  const ext = file.name.split(".").pop().toLowerCase() || "jpg";
  return `${userId}/${Date.now()}.${ext}`;
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Sube una imagen de perfil al bucket "userPhotos" de Supabase Storage
 * y retorna su URL pública.
 *
 * @param {File}   file   - Archivo de imagen seleccionado por el usuario.
 * @param {string} userId - ID del usuario autenticado (usado como carpeta RLS).
 * @returns {Promise<string>} URL pública permanente del archivo.
 * @throws {Error} Con mensaje descriptivo si la subida falla.
 */
export async function uploadProfilePicture(file, userId) {
  // 1. Validación del lado cliente
  validateFile(file);

  // 2. Generar path único
  const filePath = buildFilePath(userId, file);

  // 3. Subir a Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600", // caché de 1 hora en CDN
      upsert: true, // sobreescribe fotos anteriores del mismo usuario
      contentType: file.type,
    });

  if (uploadError) {
    throw new Error(`Error al subir la imagen: ${uploadError.message}`);
  }

  // 4. Obtener URL pública (no requiere autenticación gracias al bucket público)
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

  if (!data?.publicUrl) {
    throw new Error("No se pudo obtener la URL pública de la imagen.");
  }

  return data.publicUrl;
}
