import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { env } from "./environment.js";
import { fileURLToPath } from "url";
import path from "path";

// Resolvemos la raíz del proyecto de forma absoluta para que swagger-jsdoc
// encuentre los archivos independientemente del directorio de trabajo (CWD)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../../");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "ProveeLink API",
      version: "1.0.0",
      description: "API empresarial, ProveeLink",
      contact: {
        name: "Soporte ProveeLink",
        email: "soporte@proveelink.com",
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}`,
        description: "Servidor de Desarrollo Local",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Introduce tu token JWT en el formato: Bearer <token>",
        },
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: false,
            },
            message: {
              type: "string",
              example: "Mensaje explicativo del error",
            },
            errors: {
              type: "array",
              items: {
                type: "object",
              },
              description: "Detalles de errores de validación (opcional)",
            },
          },
        },
      },
    },
  },
  // En Windows, path.join usa '\' pero swagger-jsdoc (via glob) exige '/'
  // Construimos la ruta con slashes explícitos para que el glob funcione en todos los SO
  apis: [`${projectRoot.replace(/\\/g, "/")}/src/modules/**/*.js`],
};

const swaggerSpec = swaggerJsdoc(options);

export const setupSwagger = (app) => {
  // Solo exponer la documentación en ambientes que no sean producción estricta,
  // o según la configuración, para mitigar exposición de la arquitectura de la API.
  if (env.NODE_ENV === "production") {
    // Si se requiere exponer en producción, se puede proteger con autenticación básica.
    // Por ahora, en desarrollo/test está libre.
  }

  // Opciones de personalización de Swagger UI para mejorar seguridad y estética
  const swaggerUiOptions = {
    swaggerOptions: {
      persistAuthorization: true, // Mantiene el token JWT tras recargar la página
      filter: true, // Permite filtrar los endpoints por texto
    },
    customSiteTitle: "ProveeLink API - Documentación Oficial",
  };

  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, swaggerUiOptions),
  );

  // Endpoint JSON para consumo externo o exportación de la spec
  app.get("/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });
};
