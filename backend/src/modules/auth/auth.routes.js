import { Router } from "express";
import * as authController from "./auth.controller.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import { authenticate } from "../../middlewares/auth.middlewares.js";
import {
  loginSchema,
  refreshSchema,
  registerSchema,
  verifyEmailSchema,
  resendOtpSchema,
} from "./auth.schema.js";


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
router.post(
  "/refresh",
  validateRequest(refreshSchema),
  authController.refreshToken,
);

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

/**
 * @openapi
 * /api/v1/auth/register:
 *   post:
 *     summary: Registrar nuevo usuario
 *     description: >-
 *       Crea un usuario con status 'pending', genera un OTP de 6 dígitos,
 *       lo almacena hasheado en verify_email y envía el código al correo del usuario.
 *       El usuario debe verificar el OTP con POST /api/v1/auth/verify para activar su cuenta.
 *     tags:
 *       - Autenticación
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - role_id
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "nuevo@usuario.com"
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: "Mín. 8 caracteres, una mayúscula y un número."
 *                 example: "Segura123"
 *               role_id:
 *                 type: string
 *                 format: uuid
 *                 example: "d3b07384-d113-4956-a5b6-76472251cf78"
 *     responses:
 *       201:
 *         description: Usuario registrado. Se ha enviado el código OTP al correo.
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
 *                   example: "Registro exitoso. Revisa tu correo para verificar tu cuenta."
 *                 data:
 *                   type: object
 *                   properties:
 *                     user_id:
 *                       type: string
 *                       format: uuid
 *                     email:
 *                       type: string
 *       400:
 *         description: Error de validación.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: El correo electrónico ya está registrado.
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
router.post(
  "/register",
  validateRequest(registerSchema),
  authController.register,
);

/**
 * @openapi
 * /api/v1/auth/verify:
 *   post:
 *     summary: Verificar OTP y activar cuenta
 *     description: >-
 *       Valida el código OTP enviado al correo del usuario.
 *       Si es correcto y no ha expirado, activa la cuenta (status = 'active')
 *       y devuelve tokens de acceso para auto-login inmediato.
 *     tags:
 *       - Autenticación
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - code
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "nuevo@usuario.com"
 *               code:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 6
 *                 description: "Código OTP de 6 dígitos recibido por correo."
 *                 example: "482931"
 *     responses:
 *       200:
 *         description: Cuenta verificada y activada. Devuelve tokens para auto-login.
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
 *                   example: "Correo verificado exitosamente. ¡Bienvenido a ProveeLink!"
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                     refreshToken:
 *                       type: string
 *                     expiresIn:
 *                       type: string
 *                       example: "24h"
 *       400:
 *         description: OTP incorrecto, expirado o no encontrado.
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
router.post(
  "/verify",
  validateRequest(verifyEmailSchema),
  authController.verifyEmail,
);

/**
 * @openapi
 * /api/v1/auth/resend-otp:
 *   post:
 *     summary: Reenviar código OTP
 *     description: >-
 *       Genera un nuevo OTP de 6 dígitos para una cuenta en estado 'pending',
 *       actualiza el registro en verify_email (reseteando expiración e intentos fallidos)
 *       y envía el nuevo código al correo del usuario.
 *     tags:
 *       - Autenticación
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "nuevo@usuario.com"
 *     responses:
 *       200:
 *         description: Nuevo OTP enviado exitosamente.
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
 *                   example: "Se ha enviado un nuevo código de verificación a tu correo."
 *       400:
 *         description: La cuenta ya está activa o no requiere verificación.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: No existe una cuenta registrada con ese correo.
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
router.post(
  "/resend-otp",
  validateRequest(resendOtpSchema),
  authController.resendOtp,
);

/**
 * @openapi
 * /api/v1/auth/upgrade-role:
 *   post:
 *     summary: Obtener tokens frescos con el rol actual de la cuenta
 *     description: >-
 *       Endpoint protegido que re-emite un access token y refresh token leyendo
 *       el rol vigente del usuario directamente desde la base de datos.
 *       Se usa principalmente después de crear una empresa, cuando el JWT
 *       antiguo todavía refleja el rol "Cliente" en lugar de "Empresa".
 *       El cliente debe reemplazar sus tokens almacenados con los que devuelve
 *       este endpoint.
 *     tags:
 *       - Autenticación
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tokens actualizados exitosamente con el rol vigente.
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
 *                   example: "Tokens actualizados. Rol vigente: Empresa"
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken:
 *                       type: string
 *                       description: Nuevo JWT de acceso con el rol correcto (24h).
 *                     refreshToken:
 *                       type: string
 *                       description: Nuevo refresh token (7 días).
 *                     expiresIn:
 *                       type: string
 *                       example: "24h"
 *                     role_name:
 *                       type: string
 *                       description: Nombre del rol actual del usuario.
 *                       example: "Empresa"
 *       401:
 *         description: No autenticado o token inválido.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: La cuenta no está activa.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Usuario no encontrado.
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
router.post("/upgrade-role", authenticate, authController.upgradeRole);

export default router;

