import { Router } from "express";
import * as categoryController from "../categories/categoryController.js";
import {
  createCategorySchema,
  updateCategorySchema,
  categoryIdParamSchema,
  getCategoryQuerySchema,
} from "../categories/category.Schema.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import { authenticate, authorize } from "../../middlewares/auth.middlewares.js";

const router = Router();

// Todos los endpoints de categorías requieren autenticación
router.use(authenticate);

/**
 * @openapi
 * components:
 *   schemas:
 *     Category:
 *       type: object
 *       required:
 *         - id
 *         - name
 *         - status
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: ID único autogenerado de la categoría (UUID v4).
 *         parent_id:
 *           type: string
 *           format: uuid
 *           nullable: true
 *           description: ID de la categoría padre (null si es una categoría raíz).
 *         parent_name:
 *           type: string
 *           nullable: true
 *           description: Nombre de la categoría padre (null si es raíz).
 *         name:
 *           type: string
 *           description: Nombre único identificador de la categoría.
 *         icon_url:
 *           type: string
 *           format: uri
 *           nullable: true
 *           description: URL del ícono representativo de la categoría.
 *         status:
 *           type: string
 *           enum:
 *             - activo
 *             - inactivo
 *           description: Estado actual de la categoría en el sistema.
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Fecha de creación de la categoría.
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Fecha de la última actualización de la categoría.
 *       example:
 *         id: "f3c9e2a1-4b87-4d56-b921-3e7f1a2c0d45"
 *         parent_id: null
 *         parent_name: null
 *         name: "Electrónica"
 *         icon_url: "https://storage.api.com/icons/electronica.svg"
 *         status: "activo"
 *         created_at: "2026-07-01T10:00:00.000Z"
 *         updated_at: "2026-07-01T10:00:00.000Z"
 *
 *     CategoryInput:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *           description: Nombre único de la categoría. Mínimo 2 y máximo 100 caracteres.
 *         icon_url:
 *           type: string
 *           format: uri
 *           nullable: true
 *           description: URL opcional del ícono de la categoría.
 *       example:
 *         name: "Electrónica"
 *         icon_url: "https://storage.api.com/icons/electronica.svg"
 *
 *     CategoryUpdate:
 *       type: object
 *       description: >-
 *         Todos los campos son opcionales. Al menos uno debe estar presente para ejecutar la actualización.
 *       properties:
 *         name:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *           description: Nuevo nombre de la categoría (debe ser único en el sistema).
 *         icon_url:
 *           type: string
 *           format: uri
 *           nullable: true
 *           description: Nueva URL del ícono de la categoría. Puede enviarse null para eliminarlo.
 *       example:
 *         name: "Electrónica y Gadgets"
 *         icon_url: "https://storage.api.com/icons/electronica-v2.svg"
 */

/**
 * @openapi
 * /api/v1/categories:
 *   post:
 *     summary: Crear una nueva categoría
 *     description: Registra una categoría en el sistema validando que el nombre no colisione con una categoría existente.
 *     tags:
 *       - Categorías
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CategoryInput'
 *     responses:
 *       201:
 *         description: Categoría creada con éxito.
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
 *                   example: "Categoria creada exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/Category'
 *       400:
 *         description: Error de validación en la estructura de los datos (Zod).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Conflicto - El nombre de la categoría ya está registrado en el sistema.
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
 *     summary: Obtener todas las categorías
 *     description: Retorna un listado paginado de las categorías registradas con soporte para filtro de búsqueda por nombre.
 *     tags:
 *       - Categorías
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
 *         description: Elementos máximos por página (máximo 100).
 *       - in: query
 *         name: name
 *         schema:
 *           type: string
 *         description: Término de búsqueda parcial para filtrar por nombre de categoría (insensible a mayúsculas/minúsculas).
 *     responses:
 *       200:
 *         description: Lista de categorías recuperada exitosamente.
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
 *                     $ref: '#/components/schemas/Category'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 20
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
 *         description: Parámetros de consulta inválidos.
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
  "/",
  validateRequest(createCategorySchema),
  categoryController.createCategory,
);
router.get(
  "/",
  validateRequest(getCategoryQuerySchema),
  categoryController.getCategory,
);

/**
 * @openapi
 * /api/v1/categories/{id}:
 *   get:
 *     summary: Obtener una categoría por su ID
 *     description: Recupera una única categoría según su identificador único (UUID v4).
 *     tags:
 *       - Categorías
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Identificador único UUID v4 de la categoría.
 *     responses:
 *       200:
 *         description: Categoría encontrada con éxito.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Category'
 *       400:
 *         description: El identificador enviado en la ruta no es un UUID válido.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: La categoría no existe en el sistema.
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
 *     summary: Actualizar una categoría existente
 *     description: Permite actualizar el nombre o el ícono de una categoría en base a su ID. Valida la unicidad del nombre si se modifica.
 *     tags:
 *       - Categorías
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Identificador único UUID v4 de la categoría a actualizar.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CategoryUpdate'
 *     responses:
 *       200:
 *         description: Categoría actualizada con éxito.
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
 *                   example: "Categoria actualizada correctamente"
 *                 data:
 *                   $ref: '#/components/schemas/Category'
 *       400:
 *         description: El UUID es inválido o no se enviaron datos para actualizar.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: La categoría con el ID provisto no existe.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Conflicto - El nuevo nombre de la categoría ya está siendo utilizado por otra.
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
router.get(
  "/:id",
  validateRequest(categoryIdParamSchema),
  categoryController.getCategoryById,
);
router.put(
  "/:id",
  validateRequest(updateCategorySchema),
  categoryController.updateCategory,
);

/**
 * DELETE /api/v1/categories/:id — Solo Administradores
 * Elimina una categoría si no tiene productos ni subcategorías asociadas.
 */
router.delete(
  "/:id",
  authorize("Admin"),
  validateRequest(categoryIdParamSchema),
  categoryController.deleteCategory,
);

export default router;
