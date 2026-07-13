import { Router } from "express";
import * as authController from "./auth.controller.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import { authenticate } from "../../middlewares/auth.middlewares.js";
import { loginSchema, refreshSchema } from "./auth.schema.js";

const router = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     LoginInput:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           description: Correo electrónico registrado del usuario.
 *           example: "juan.perez@empresa.com"
 *         password:
 *           type: string
 *           description: Contraseña en texto plano del usuario.
 *           example: "MiContrasena123"
 *
 *     LoginResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *           example: "Inicio de sesión exitoso"
 *         data:
 *           type: object
 *           properties:
 *             accessToken:
 *               type: string
 *               description: JWT de acceso (24h de validez).
 *             refreshToken:
 *               type: string
 *               description: JWT de renovación (7 días de validez).
 *             expiresIn:
 *               type: string
 *               example: "24h"
 *             user:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 email:
 *                   type: string
 *                 role_id:
 *                   type: string
 *                   format: uuid
 *                 role_name:
 *                   type: string
 *
 *     RefreshInput:
 *       type: object
 *       required:
 *         - refreshToken
 *       properties:
 *         refreshToken:
 *           type: string
 *           description: Refresh token obtenido en el login.
 *
 *     MeResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *               format: uuid
 *             email:
 *               type: string
 *             role_id:
 *               type: string
 *               format: uuid
 *             role_name:
 *               type: string
 *             iat:
 *               type: integer
 *             exp:
 *               type: integer
 */

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     description: >-
 *       Autentica al usuario con email y contraseña.
 *       Devuelve un access token (JWT, 24h) y un refresh token (JWT, 7d).
 *       La cuenta debe estar en estado "active" para poder iniciar sesión.
 *     tags:
 *       - Autenticación
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginInput'
 *     responses:
 *       200:
 *         description: Inicio de sesión exitoso. Devuelve access y refresh tokens.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Error de validación — email o contraseña con formato inválido.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Credenciales inválidas.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: La cuenta existe pero no está activa.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error interno del servidor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/login", validateRequest(loginSchema), authController.login);

/**
 * @openapi
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Renovar access token
 *     description: >-
 *       Genera un nuevo access token a partir de un refresh token válido.
 *       Útil para evitar que el usuario tenga que iniciar sesión al expirar el access token.
 *     tags:
 *       - Autenticación
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshInput'
 *     responses:
 *       200:
 *         description: Nuevo access token generado exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     expiresIn:
 *                       type: string
 *                       example: "24h"
 *       400:
 *         description: El refreshToken no fue enviado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Refresh token inválido o expirado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error interno del servidor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/refresh", validateRequest(refreshSchema), authController.refreshToken);

/**
 * @openapi
 * /api/v1/auth/logout:
 *   post:
 *     summary: Cerrar sesión
 *     description: >-
 *       Endpoint de logout. La implementación es stateless:
 *       el servidor indica al cliente que descarte los tokens.
 *       Para una implementación con blacklist de tokens, se puede extender este endpoint.
 *     tags:
 *       - Autenticación
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sesión cerrada exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Sesión cerrada exitosamente. Descarta tus tokens en el cliente."
 *       401:
 *         description: No autenticado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/logout", authenticate, authController.logout);

/**
 * @openapi
 * /api/v1/auth/me:
 *   get:
 *     summary: Obtener perfil del usuario autenticado
 *     description: >-
 *       Devuelve los datos del usuario que está autenticado actualmente,
 *       extraídos directamente del payload del JWT (sin consulta a la base de datos).
 *     tags:
 *       - Autenticación
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil del usuario autenticado obtenido con éxito.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MeResponse'
 *       401:
 *         description: No autenticado o token inválido.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/me", authenticate, authController.getMe);

export default router;
