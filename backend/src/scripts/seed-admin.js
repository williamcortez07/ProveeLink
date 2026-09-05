/**
 * @file seed-admin.js
 * @description Script para crear el primer usuario administrador en la base de datos.
 *              Utiliza bcryptjs para hashear la contraseña correctamente.
 *              Solo debe ejecutarse cuando no existe ningún admin en el sistema.
 *
 * Uso: node --env-file=.env src/scripts/seed-admin.js
 */

import bcrypt from "bcryptjs";
import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Cargar .env desde la raíz de /src
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
dotenv.config({ path: join(__dirname, "../.env") });

const { Pool } = pg;

const pool = new Pool({
  host:     process.env.DB_HOST     || "localhost",
  port:     Number(process.env.DB_PORT) || 5434,
  user:     process.env.DB_USER     || "postgres",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME     || "proveeLinkDev",
});

// ─── Datos del admin a crear ──────────────────────────────────────────────────
const ADMIN = {
  email:      "w04910000@gmail.com",
  password:   "William$12",
  first_name: "William",
  last_name:  "Admin",
};
// ─────────────────────────────────────────────────────────────────────────────

async function seedAdmin() {
  const client = await pool.connect();
  try {
    console.log("🔍 Buscando rol 'Admin'...");
    const roleRes = await client.query(
      `SELECT id FROM public.roles WHERE LOWER(name) = 'admin' LIMIT 1;`
    );
    if (roleRes.rows.length === 0) {
      throw new Error("❌ El rol 'Admin' no existe en la tabla roles. Créalo primero.");
    }
    const adminRoleId = roleRes.rows[0].id;
    console.log(`✅ Rol Admin encontrado: ${adminRoleId}`);

    // Hashear contraseña con bcrypt (12 rondas)
    console.log("🔐 Hasheando contraseña...");
    const password_hash = await bcrypt.hash(ADMIN.password, 12);

    // Upsert: Crear o actualizar usuario admin
    const upsertQuery = `
      INSERT INTO public.users
        (role_id, first_name, last_name, email, password_hash, status)
      VALUES ($1, $2, $3, $4, $5, 'active')
      ON CONFLICT (email) 
      DO UPDATE SET 
        role_id = EXCLUDED.role_id,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        password_hash = EXCLUDED.password_hash,
        status = 'active'
      RETURNING id, email, status;
    `;

    const insertRes = await client.query(upsertQuery, [
      adminRoleId, 
      ADMIN.first_name, 
      ADMIN.last_name, 
      ADMIN.email, 
      password_hash
    ]);

    const created = insertRes.rows[0];
    console.log("\n🎉 ¡Administrador procesado exitosamente!");
    console.log(`   ID:     ${created.id}`);
    console.log(`   Email:  ${created.email}`);
    console.log(`   Estado: ${created.status}`);
    console.log(`\n📝 Credenciales de acceso:`);
    console.log(`   Email:    ${ADMIN.email}`);
    console.log(`   Password: ${ADMIN.password}`);
    console.log(`\n⚠️  Elimina o no commitees este script con datos sensibles.`);
  } catch (err) {
    console.error("\n❌ Error al crear/actualizar el administrador:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedAdmin();
