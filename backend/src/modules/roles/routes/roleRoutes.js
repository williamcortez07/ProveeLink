import { Router } from 'express';
import * as roleController from '../controllers/roleController.js';
import { validateRequest } from '../../../middlewares/validateRequest.js';
import { authenticate } from '../../../middlewares/auth.middlewares.js';
import {
  createRoleSchema,
  updateRoleSchema,
  roleIdParamSchema,
  getRolesQuerySchema
} from '../schemas/roleSchema.js';

const router = Router();

// Todos los endpoints de roles requieren autenticación
router.use(authenticate);

/**
 * @openapi
 * components:
 *   schemas:
 *     Role:
 *       type: object
 *       required:
 *         - id
 *         - name
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: ID único autogenerado del rol (UUID v4).
 *         name:
 *           type: string
 *           description: Nombre único identificador del rol.
 *         description:
 *           type: string
 *           description: Descripción detallada de las funciones del rol.
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Fecha de creación del rol.
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Fecha de última actualización del rol.
 *       example:
 *         id: "d3b07384-d113-4956-a5b6-76472251cf78"
 *         name: "COMPRAS"
 *         description: "Rol con permisos para gestionar órdenes de compra y proveedores."
 *         created_at: "2026-07-02T22:55:03.000Z"
 *         updated_at: "2026-07-02T22:55:03.000Z"
 *
 *     RoleInput:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           maxLength: 50
 *           description: Nombre único del rol. Debe tener al menos 2 caracteres.
 *         description:
 *           type: string
 *           description: Descripción opcional del rol.
 *       example:
 *         name: "COMPRAS"
 *         description: "Gestiona compras y cotizaciones de la empresa"
 *
 *     RoleUpdate:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           maxLength: 50
 *           description: Nombre único del rol (opcional).
 *         description:
 *           type: string
 *           description: Descripción opcional del rol.
 *       example:
 *         description: "Permisos ajustados para el departamento de compras"
 */

/**
 * @openapi
 * /api/v1/roles:
 *   post:
 *     summary: Crear un nuevo rol
 *     description: Registra un rol en el sistema validando que el nombre no colisione con uno existente.
 *     tags:
 *       - Roles
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RoleInput'
 *     responses:
 *       201:
 *         description: Rol creado con éxito.
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
 *                   example: "Rol creado exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/Role'
 *       400:
 *         description: Error de validación en la estructura de los datos (Zod).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Conflicto - El nombre de rol ya está registrado en el sistema.
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
 *
 *   get:
 *     summary: Obtener todos los roles
 *     description: Retorna un listado de los roles registrados con soporte para filtros de búsqueda y paginación.
 *     tags:
 *       - Roles
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Página a consultar (base 1).
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Elementos máximos por página.
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Término de búsqueda parcial para filtrar por el nombre del rol (insensible a mayúsculas/minúsculas).
 *     responses:
 *       200:
 *         description: Lista de roles recuperada exitosamente.
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
 *                     $ref: '#/components/schemas/Role'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 12
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     totalPages:
 *                       type: integer
 *                       example: 2
 *       400:
 *         description: Parámetros de búsqueda inválidos.
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
router.post('/', validateRequest(createRoleSchema), roleController.createRole);
router.get('/', validateRequest(getRolesQuerySchema), roleController.getRoles);

/**
 * @openapi
 * /api/v1/roles/{id}:
 *   get:
 *     summary: Obtener un rol por su ID
 *     description: Recupera un único rol según su identificador único (UUID).
 *     tags:
 *       - Roles
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Identificador único UUID v4 del rol.
 *     responses:
 *       200:
 *         description: Rol encontrado con éxito.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Role'
 *       400:
 *         description: El identificador enviado en la ruta no es un UUID válido.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: El rol no existe en el sistema.
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
 *
 *   put:
 *     summary: Actualizar un rol existente
 *     description: Permite actualizar el nombre o la descripción de un rol en base a su ID. Valida la unicidad del nombre si se modifica.
 *     tags:
 *       - Roles
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Identificador único UUID v4 del rol a actualizar.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RoleUpdate'
 *     responses:
 *       200:
 *         description: Rol actualizado con éxito.
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
 *                   example: "Rol actualizado exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/Role'
 *       400:
 *         description: El UUID es inválido o no se enviaron datos para actualizar.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: El rol con el ID proveído no existe.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Conflicto - El nuevo nombre del rol ya está siendo ocupado por otro.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error de servidor interno.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:id', validateRequest(roleIdParamSchema), roleController.getRoleById);
router.put('/:id', validateRequest(updateRoleSchema), roleController.updateRole);

export default router;
