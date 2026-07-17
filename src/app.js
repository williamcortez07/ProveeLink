import express from "express";
import cors from "cors";
import { logger } from "./utils/logger.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import authRoutes from "./modules/auth/auth.routes.js";
import roleRoutes from "./modules/roles/routes/roleRoutes.js";
import userRoutes from "./modules/users/userRoutes.js";
import categoryRoutes from "./modules/categories/categoryRoutes.js";
import companyRoutes from "./modules/companies/companyRoutes.js";
import supplierRoutes from "./modules/suppliers/supplierRoutes.js";
import productRoutes from "./modules/products/productRoutes.js";
import { setupSwagger } from "./config/swagger.js";
import { env } from "./config/environment.js";

const app = express();

setupSwagger(app);

// ── CORS ─────────────────────────────────────────────────────────
// Lee CORS_ORIGIN del .env. Soporta '*' o lista de dominios separados por coma.
const rawOrigins = env.CORS_ORIGIN.trim();
const corsOptions = {
  origin:
    rawOrigins === "*"
      ? "*"
      : rawOrigins.split(",").map((o) => o.trim()),
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  // credentials solo funciona cuando origin NO es '*'
  credentials: rawOrigins !== "*",
};
app.use(cors(corsOptions));

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "ProveeLink API corriendo",
    version: "1.0.0",
  });
});

// ── Módulo de Autenticación (público — no requiere token) ──
app.use("/api/v1/auth", authRoutes);

// ── Módulos protegidos (autenticación aplicada por ruta individual) ──
// Módulo de Roles
app.use("/api/v1/roles", roleRoutes);
// Módulo de Usuarios
app.use("/api/v1/users", userRoutes);
// Módulo de Categorías
app.use("/api/v1/categories", categoryRoutes);
// Módulo de Empresas
app.use("/api/v1/companies", companyRoutes);
// Módulo de Proveedores
app.use("/api/v1/suppliers", supplierRoutes);
// Módulo de Productos
app.use("/api/v1/products", productRoutes);

app.use(errorHandler);

export default app;

// Arranque standalone — solo activo cuando se ejecuta app.js directamente
const isMain = process.argv[1] && process.argv[1].endsWith("app.js");
if (isMain) {
  app.listen(env.PORT, () => {
    logger.info(
      `Servidor (modo dev) corriendo en http://localhost:${env.PORT}`,
    );
    logger.info(
      `Swagger UI disponible en http://localhost:${env.PORT}/api-docs`,
    );
  });
}
