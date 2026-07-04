import express from 'express';
import { logger } from './utils/logger.js';
import { errorHandler } from './middlewares/errorHandler.js';
import roleRoutes from './modules/roles/routes/roleRoutes.js';
import { setupSwagger } from './config/swagger.js';
import { env } from './config/environment.js';

const app = express();

setupSwagger(app);

app.use(express.json());

app.get('/', (req, res) => {
  res.json({ success: true, message: 'ProveeLink API corriendo', version: '1.0.0' });
});

// Módulo de Roles
app.use('/api/v1/roles', roleRoutes);

app.use(errorHandler);

export default app;

// Arranque standalone — solo activo cuando se ejecuta app.js directamente
// Permite servir Swagger sin necesidad de conexión a BD (útil en desarrollo)
const isMain = process.argv[1] && process.argv[1].endsWith('app.js');
if (isMain) {
  app.listen(env.PORT, () => {
    logger.info(`Servidor (modo dev) corriendo en http://localhost:${env.PORT}`);
    logger.info(`Swagger UI disponible en http://localhost:${env.PORT}/api-docs`);
  });
}
