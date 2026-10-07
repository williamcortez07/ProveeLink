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
import commentRoutes from "./modules/comments/commentRoutes.js";
import ratingRoutes from "./modules/ratings/ratingRoutes.js";
import adminRoutes from "./modules/admin/adminRoutes.js";
import verificationRoutes from "./modules/verification/verificationRoutes.js";
import { setupSwagger } from "./config/swagger.js";
import { env } from "./config/environment.js";

const app = express();

// Configuración para proxy inverso (Render, Vercel, Nginx) para lectura fidedigna de IPs
app.set("trust proxy", 1);

setupSwagger(app);

// ── CORS SEGURO ─────────────────────────────────────────────────────────
// Parsear lista explícita de orígenes permitidos.
// En desarrollo, incluir localhost por defecto si CORS_ORIGIN es '*' o vacío.
const defaultDevOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
];

const rawOrigins = (env.CORS_ORIGIN || "").trim();
let allowedOrigins = [];

if (rawOrigins && rawOrigins !== "*") {
  allowedOrigins = rawOrigins
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);
} else if (env.NODE_ENV !== "production") {
  allowedOrigins = defaultDevOrigins;
}

const corsOptions = {
  origin: (origin, callback) => {
    // Permitir solicitudes sin origen (como clientes móviles, CLI, curl o same-origin)
    if (!origin) {
      return callback(null, true);
    }
    const normalizedOrigin = origin.replace(/\/+$/, "");
    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }
    // No reflejar orígenes no autorizados
    return callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
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
// Módulo de Comentarios
app.use("/api/v1/comments", commentRoutes);
// Módulo de Ratings
app.use("/api/v1/ratings", ratingRoutes);
// Módulo de Administración (protegido — requiere rol Admin)
app.use("/api/v1/admin", adminRoutes);
// Módulo de Verificación y Suscripción (PayPal)
app.use("/api/v1/verification", verificationRoutes);

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
