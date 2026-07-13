import { Router } from "express";
import * as userController from "../users/userController.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import { authenticate } from "../../middlewares/auth.middlewares.js";
import {
  createUserSchema,
  getUsersSchema,
  searchUsersSchema,
  userIdParamSchema,
  updateUserSchema,
  changeStatusSchema,
} from "../users/userSchema.js";

const router = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - id
 *         - role_id
 *         - role_name
 *         - first_name
 *         - last_name
 *         - email
 *         - status
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: ID único autogenerado del usuario (UUID v4).
 *         role_id:
 *           type: string
 *           format: uuid
 *           description: ID del rol asignado al usuario.
 *         role_name:
 *           type: string
 *           description: Nombre legible del rol asociado (ej. COMPRAS, ADMIN).
 *         first_name:
 *           type: string
 *           description: Nombre(s) del usuario.
 *         last_name:
 *           type: string
 *           description: Apellido(s) del usuario.
 *         email:
 *           type: string
 *           format: email
 *           description: Correo electrónico único del usuario.
 *         phone:
 *           type: string
 *           nullable: true
 *           description: Número de teléfono de contacto (opcional).
 *         profile_picture_url:
 *           type: string
 *           format: uri
 *           nullable: true
 *           description: URL de la foto de perfil del usuario.
 *         status:
 *           type: string
 *           description: Estado actual del usuario en el sistema.
 *           example: "ACTIVE"
 *         last_login_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Fecha y hora del último inicio de sesión.
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Fecha de registro del usuario.
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Fecha de la última actualización de los datos del usuario.
 *       example:
 *         id: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d"
 *         role_id: "d3b07384-d113-4956-a5b6-76472251cf78"
 *         role_name: "COMPRAS"
 *         first_name: "Juan"
 *         last_name: "Pérez"
 *         email: "juan.perez@empresa.com"
 *         phone: "+50588888888"
 *         profile_picture_url: "https://storage.api.com/profiles/juan.jpg"
 *         status: "ACTIVE"
 *         last_login_at: "2026-07-06T12:00:00.000Z"
 *         created_at: "2026-07-02T22:55:03.000Z"
 *         updated_at: "2026-07-06T12:00:00.000Z"
 *
 *     UserInput:
 *       type: object
 *       required:
 *         - role_id
 *         - first_name
 *         - last_name
 *         - email
 *         - password
 *       properties:
 *         role_id:
 *           type: string
 *           format: uuid
 *           description: UUID del rol a asignar.
 *         first_name:
 *           type: string
 *           description: Nombre del usuario.
 *         last_name:
 *           type: string
 *           description: Apellido del usuario.
 *         email:
 *           type: string
 *           format: email
 *           description: Correo electrónico único del usuario.
 *         phone:
 *           type: string
 *           nullable: true
 *           description: Teléfono opcional.
 *         password:
 *           type: string
 *           description: Contraseña en texto plano. El servidor la hashea automáticamente con bcrypt.
 *         profile_picture_url:
 *           type: string
 *           format: uri
 *           nullable: true
 *           description: URL opcional de la imagen de perfil. Puede enviarse null o simplemente omitirse.
 *       example:
 *         role_id: "d3b07384-d113-4956-a5b6-76472251cf78"
 *         first_name: "Juan"
 *         last_name: "Pérez"
 *         email: "juan.perez@empresa.com"
 *         phone: "+50588888888"
 *         password: "MiContrasena123"
 *         profile_picture_url: null
 *
 *     UserUpdate:
 *       type: object
 *       description: >-
 *         Todos los campos son opcionales. Se actualizan únicamente los campos enviados.
 *         Al menos uno debe estar presente.
 *       properties:
 *         first_name:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *           description: Nombre del usuario.
 *         last_name:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *           description: Apellido del usuario.
 *         email:
 *           type: string
 *           format: email
 *           description: Nuevo correo electrónico (debe ser único en el sistema).
 *         phone:
 *           type: string
 *           nullable: true
 *           description: Número de teléfono de contacto.
 *         password:
 *           type: string
 *           description: >-
 *             Nueva contraseña en texto plano. El servidor la hashea automáticamente con bcrypt.
 *             Mínimo 8 caracteres, una mayúscula y un número.
 *         profile_picture_url:
 *           type: string
 *           format: uri
 *           nullable: true
 *           description: URL de la foto de perfil. Enviar null para eliminarla.
 *         role_id:
 *           type: string
 *           format: uuid
 *           description: UUID del nuevo rol a asignar al usuario.
 *       example:
 *         first_name: "Juan Carlos"
 *         last_name: "Pérez"
 *         email: "jc.perez@empresa.com"
 *         phone: "+50577777777"
 *         password: "NuevaClave123"
 *         profile_picture_url: "https://storage.api.com/profiles/jc.jpg"
 *
 *     UserStatusUpdate:
 *       type: object
 *       required:
 *         - status
 *       description: >-
 *         Permite cambiar el estado del usuario de forma aislada.
 *         Úsalo para dar de baja lógica (inactive) o reactivar (active) a un usuario.
 *       properties:
 *         status:
 *           type: string
 *           enum:
 *             - active
 *             - inactive
 *             - suspended
 *           description: Nuevo estado. Para eliminación lógica usar "inactive".
 *       example:
 *         status: "inactive"
 */

/**
 * @openapi
 * /api/v1/users:
 *   post:
 *     summary: Crear un nuevo usuario
 *     description: Registra un usuario en la base de datos vinculándolo a un rol.
 *     tags:
 *       - Usuarios
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserInput'
 *     responses:
 *       201:
 *         description: Usuario creado exitosamente.
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
 *                   example: "Usuario creado exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Error de validación en los datos provistos (Zod).
 *       409:
 *         description: Conflicto - El email ya está registrado en el sistema.
 *       500:
 *         description: Error interno del servidor.
 *
 *   get:
 *     summary: Obtener listado de usuarios con filtros
 *     description: Recupera una lista paginada de usuarios de la base de datos, permitiendo filtrar por estado y rol.
 *     tags:
 *       - Usuarios
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Cantidad máxima de registros por página.
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página (se traduce internamente a offset).
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filtrar usuarios por su estado (ej. ACTIVE, INACTIVE).
 *       - in: query
 *         name: role_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar usuarios por un ID de rol específico.
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: "created_at"
 *         description: Campo de ordenamiento (ej. first_name, created_at).
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum:
 *             - asc
 *             - desc
 *           default: "desc"
 *         description: Sentido del ordenamiento.
 *     responses:
 *       200:
 *         description: Listado de usuarios obtenido con éxito.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 45
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     totalPages:
 *                       type: integer
 *                       example: 5
 *       500:
 *         description: Error interno del servidor.
 */
// POST / es público (registro de usuarios)
router.post("/", validateRequest(createUserSchema), userController.createUser);
// El resto de endpoints requieren autenticación
router.get("/", authenticate, validateRequest(getUsersSchema), userController.getUsers);

/**
 * @openapi
 * /api/v1/users/search:
 *   get:
 *     summary: Buscar usuarios por coincidencia de texto
 *     description: Realiza una búsqueda parcial (ILIKE) por nombre, apellido o nombre completo concatenado.
 *     tags:
 *       - Usuarios
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *         description: Término o texto de búsqueda para el nombre o apellido.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Cantidad máxima de resultados.
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página.
 *     responses:
 *       200:
 *         description: Resultados de la búsqueda obtenidos con éxito.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 3
 *       400:
 *         description: Falta el parámetro requerido "query".
 *       500:
 *         description: Error interno del servidor.
 */
router.get(
  "/search",
  authenticate,
  validateRequest(searchUsersSchema),
  userController.searchUsers,
);

/**
 * @openapi
 * /api/v1/users/{id}:
 *   get:
 *     summary: Obtener usuario por ID
 *     description: Retorna la información completa de un usuario cruzado con su rol mediante su UUID v4.
 *     tags:
 *       - Usuarios
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID v4 identificador del usuario.
 *     responses:
 *       200:
 *         description: Usuario encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Formato de ID inválido (no es un UUID válido).
 *       404:
 *         description: El usuario no existe en el sistema.
 *       500:
 *         description: Error interno del servidor.
 *
 *   put:
 *     summary: Actualizar usuario (Reemplazo completo/parcial)
 *     description: Actualiza de forma dinámica las propiedades enviadas en el cuerpo para el usuario especificado.
 *     tags:
 *       - Usuarios
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID v4 del usuario a actualizar.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserUpdate'
 *     responses:
 *       200:
 *         description: Usuario actualizado con éxito.
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
 *                   example: "Usuario actualizado exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Parámetros inválidos o error de validación en la estructura.
 *       404:
 *         description: El usuario no fue encontrado.
 *       500:
 *         description: Error interno del servidor.
 *
 *   patch:
 *     summary: Modificar parcialmente propiedades del usuario
 *     description: Modifica de manera parcial los campos del usuario compartiendo la lógica del endpoint PUT.
 *     tags:
 *       - Usuarios
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserUpdate'
 *     responses:
 *       200:
 *         description: Usuario modificado con éxito.
 *       404:
 *         description: Usuario no encontrado.
 *       500:
 *         description: Error de servidor.
 */
router.get(
  "/:id",
  authenticate,
  validateRequest(userIdParamSchema),
  userController.getUserById,
);
router.put(
  "/:id",
  authenticate,
  validateRequest(updateUserSchema),
  userController.updateUser,
);
router.patch(
  "/:id",
  authenticate,
  validateRequest(updateUserSchema),
  userController.updateUser,
);

/**
 * @openapi
 * /api/v1/users/{id}/status:
 *   patch:
 *     summary: Cambiar el estado de un usuario
 *     description: Permite actualizar de forma aislada y rápida el estado de actividad de un usuario (ej. dar de baja o reactivar).
 *     tags:
 *       - Usuarios
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Identificador del usuario al que se le cambiará el estado.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserStatusUpdate'
 *     responses:
 *       200:
 *         description: Estado actualizado exitosamente.
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
 *                   example: "Estado del usuario actualizado"
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Error de esquema en el estado suministrado.
 *       404:
 *         description: El usuario no existe.
 *       500:
 *         description: Error interno en el servidor.
 */
router.patch(
  "/:id/status",
  authenticate,
  validateRequest(changeStatusSchema),
  userController.changeUserStatus,
);

export default router;
