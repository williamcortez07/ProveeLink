import { Router } from "express";
import * as ratingController from "../ratings/ratingController.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import { authenticate } from "../../middlewares/auth.middlewares.js";
import {
  createRatingSchema,
  getRatingsSchema,
  getRatingStatsSchema,
  ratingIdParamsSchema,
  updateRatingSchema,
} from "../ratings/ratingSchema.js";

const router = Router();

// Todos los endpoints de ratings requieren autenticación
router.use(authenticate);

/**
 * @openapi
 * components:
 *   schemas:
 *     RatingAuthor:
 *       type: object
 *       properties:
 *         first_name:
 *           type: string
 *           description: Nombre del autor del rating.
 *         last_name:
 *           type: string
 *           description: Apellido del autor del rating.
 *         profile_picture_url:
 *           type: string
 *           nullable: true
 *           description: URL de la foto de perfil del autor.
 *
 *     Rating:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: ID único del rating.
 *         user_id:
 *           type: string
 *           format: uuid
 *           description: ID del usuario que publicó el rating.
 *         user:
 *           $ref: '#/components/schemas/RatingAuthor'
 *         supplier_id:
 *           type: string
 *           format: uuid
 *           nullable: true
 *           description: ID del proveedor calificado. Nulo si el rating es para un producto.
 *         product_id:
 *           type: string
 *           format: uuid
 *           nullable: true
 *           description: ID del producto calificado. Nulo si el rating es para un proveedor.
 *         score:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *           description: Calificación del usuario (1 a 5 estrellas).
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Fecha de creación del rating.
 *       example:
 *         id: "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e"
 *         user_id: "d4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f90"
 *         user:
 *           first_name: "María"
 *           last_name: "Gómez"
 *           profile_picture_url: null
 *         supplier_id: "c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f"
 *         product_id: null
 *         score: 4
 *         created_at: "2026-08-10T14:20:00.000Z"
 *
 *     RatingInput:
 *       type: object
 *       required:
 *         - score
 *       description: >-
 *         Exactamente uno de supplier_id o product_id debe estar presente.
 *         Si el usuario ya calificó ese destino, el score existente será actualizado.
 *       properties:
 *         supplier_id:
 *           type: string
 *           format: uuid
 *           nullable: true
 *           description: UUID del proveedor a calificar. Mutuamente excluyente con product_id.
 *         product_id:
 *           type: string
 *           format: uuid
 *           nullable: true
 *           description: UUID del producto a calificar. Mutuamente excluyente con supplier_id.
 *         score:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *           description: Calificación de 1 a 5 estrellas.
 *       example:
 *         supplier_id: "c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f"
 *         score: 4
 *
 *     RatingScoreUpdate:
 *       type: object
 *       required:
 *         - score
 *       properties:
 *         score:
 *           type: integer
 *           minimum: 1
 *           maximum: 5
 *           description: Nuevo score del rating (1 a 5 estrellas).
 *       example:
 *         score: 5
 *
 *     RatingStats:
 *       type: object
 *       properties:
 *         average:
 *           type: number
 *           format: float
 *           nullable: true
 *           description: Promedio de calificaciones. Null si no hay ratings aún.
 *         total:
 *           type: integer
 *           description: Cantidad total de calificaciones.
 *         distribution:
 *           type: object
 *           description: Distribución de calificaciones por número de estrellas.
 *           properties:
 *             5:
 *               type: integer
 *             4:
 *               type: integer
 *             3:
 *               type: integer
 *             2:
 *               type: integer
 *             1:
 *               type: integer
 *       example:
 *         average: 4.3
 *         total: 127
 *         distribution:
 *           5: 80
 *           4: 30
 *           3: 10
 *           2: 4
 *           1: 3
 */

/**
 * @openapi
 * /api/v1/ratings:
 *   post:
 *     summary: Crear o actualizar un rating (upsert)
 *     description: >-
 *       Permite a un usuario autenticado calificar un proveedor o un producto
 *       con un score de 1 a 5 estrellas. Si el usuario ya calificó el mismo
 *       destino, el score existente será actualizado (upsert atómico).
 *       Exactamente uno de supplier_id o product_id debe estar presente.
 *       El user_id se extrae del token JWT.
 *     tags:
 *       - Ratings
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RatingInput'
 *     responses:
 *       201:
 *         description: Rating registrado exitosamente (nuevo).
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
 *                   example: "Rating registrado exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/Rating'
 *       200:
 *         description: Rating actualizado exitosamente (upsert — ya existía).
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
 *                   example: "Rating actualizado exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/Rating'
 *       400:
 *         description: >-
 *           Error de validación: score fuera de rango, ambos destinatarios
 *           provistos, ningún destinatario, proveedor o producto inexistente.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: No autenticado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: El proveedor o producto especificado no existe.
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
 *     summary: Obtener ratings con filtros y paginación
 *     description: >-
 *       Retorna un listado paginado de ratings. Se puede filtrar por proveedor,
 *       producto o usuario. Útil para mostrar las calificaciones de un proveedor
 *       o producto específico, o para consultar los ratings de un usuario.
 *     tags:
 *       - Ratings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: supplier_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar ratings de un proveedor específico.
 *       - in: query
 *         name: product_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar ratings de un producto específico.
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar ratings publicados por un usuario específico.
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página (mínimo 1).
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 100
 *         description: Cantidad de resultados por página (máximo 100).
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [score, created_at]
 *           default: created_at
 *         description: Campo de ordenamiento.
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sentido del ordenamiento.
 *     responses:
 *       200:
 *         description: Ratings recuperados exitosamente.
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
 *                   example: "Ratings recuperados exitosamente"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Rating'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     pageSize:
 *                       type: integer
 *                       example: 10
 *                     totalItems:
 *                       type: integer
 *                       example: 42
 *                     totalPages:
 *                       type: integer
 *                       example: 5
 *       400:
 *         description: Parámetros de query inválidos.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: No autenticado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       500:
 *         description: Error interno del servidor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/",
  validateRequest(createRatingSchema),
  ratingController.upsertRating,
);
router.get("/", validateRequest(getRatingsSchema), ratingController.getRatings);

/**
 * @openapi
 * /api/v1/ratings/stats:
 *   get:
 *     summary: Obtener estadísticas de ratings
 *     description: >-
 *       Retorna el promedio, el total de calificaciones y la distribución
 *       por número de estrellas (1 a 5) para un proveedor o un producto.
 *       Exactamente uno de supplier_id o product_id debe ser proporcionado.
 *     tags:
 *       - Ratings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: supplier_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID del proveedor cuyas estadísticas se desean consultar.
 *       - in: query
 *         name: product_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID del producto cuyas estadísticas se desean consultar.
 *     responses:
 *       200:
 *         description: Estadísticas obtenidas exitosamente.
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
 *                   example: "Estadísticas de ratings obtenidas exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/RatingStats'
 *       400:
 *         description: Falta supplier_id o product_id, o se proporcionaron ambos.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: No autenticado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: El proveedor o producto especificado no existe.
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
  "/stats",
  validateRequest(getRatingStatsSchema),
  ratingController.getRatingStats,
);

/**
 * @openapi
 * /api/v1/ratings/me:
 *   get:
 *     summary: Obtener mis ratings
 *     description: >-
 *       Retorna todos los ratings publicados por el usuario autenticado,
 *       con paginación. El user_id se extrae del token JWT.
 *     tags:
 *       - Ratings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número de página.
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 100
 *         description: Resultados por página.
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [score, created_at]
 *           default: created_at
 *         description: Campo de ordenamiento.
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sentido del ordenamiento.
 *     responses:
 *       200:
 *         description: Ratings del usuario autenticado recuperados exitosamente.
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
 *                   example: "Tus ratings recuperados exitosamente"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Rating'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     pageSize:
 *                       type: integer
 *                     totalItems:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       401:
 *         description: No autenticado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       500:
 *         description: Error interno del servidor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/me",
  validateRequest(getRatingsSchema),
  ratingController.getMyRatings,
);

/**
 * @openapi
 * /api/v1/ratings/{id}:
 *   get:
 *     summary: Obtener rating por ID
 *     description: Retorna un rating específico con los datos de su autor.
 *     tags:
 *       - Ratings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID v4 del rating.
 *     responses:
 *       200:
 *         description: Rating encontrado exitosamente.
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
 *                   example: "Rating encontrado exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/Rating'
 *       400:
 *         description: Formato de ID inválido.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: No autenticado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       404:
 *         description: Rating no encontrado.
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
 *     summary: Actualizar el score de un rating
 *     description: >-
 *       Modifica el score de un rating existente. Solo el autor del rating
 *       o un Administrador pueden realizar esta operación.
 *       No es posible cambiar el destinatario (supplier_id / product_id)
 *       ni el usuario propietario.
 *     tags:
 *       - Ratings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID v4 del rating a actualizar.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RatingScoreUpdate'
 *     responses:
 *       200:
 *         description: Rating actualizado exitosamente.
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
 *                   example: "Rating actualizado exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/Rating'
 *       400:
 *         description: Score inválido o ID mal formado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: No autenticado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: Sin permisos — no es el autor ni Administrador.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       404:
 *         description: Rating no encontrado.
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
 *   delete:
 *     summary: Eliminar un rating
 *     description: >-
 *       Elimina permanentemente un rating. Solo el autor del rating
 *       o un Administrador pueden realizar esta operación.
 *     tags:
 *       - Ratings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID v4 del rating a eliminar.
 *     responses:
 *       200:
 *         description: Rating eliminado exitosamente.
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
 *                   example: "Rating eliminado exitosamente"
 *       400:
 *         description: ID mal formado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: No autenticado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnauthorizedError'
 *       403:
 *         description: Sin permisos — no es el autor ni Administrador.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ForbiddenError'
 *       404:
 *         description: Rating no encontrado.
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
  validateRequest(ratingIdParamsSchema),
  ratingController.getRatingById,
);
router.put(
  "/:id",
  validateRequest(updateRatingSchema),
  ratingController.updateRating,
);
router.delete(
  "/:id",
  validateRequest(ratingIdParamsSchema),
  ratingController.deleteRating,
);

export default router;
