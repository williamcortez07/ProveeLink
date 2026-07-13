import { Router } from "express";
import * as supplierController from "../suppliers/supplierController.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import { authenticate } from "../../middlewares/auth.middlewares.js";
import {
  createSupplierSchema,
  getSupplierSchema,
  searchSupplierSchema,
  updateSupplierSchema,
  changeStatusSchema,
  supplierIdParamsSchema,
} from "../suppliers/supplierSchema.js";

const router = Router();

// Todos los endpoints de proveedores requieren autenticación
router.use(authenticate);

/**
 * @openapi
 * components:
 *   schemas:
 *     Supplier:
 *       type: object
 *       required:
 *         - id
 *         - company_id
 *         - supplier_type
 *         - service_description
 *         - geographic_coverage
 *         - operating_hours
 *         - status
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: ID único autogenerado del proveedor (UUID v4).
 *         company_id:
 *           type: string
 *           format: uuid
 *           description: ID de la empresa a la que pertenece este perfil de proveedor.
 *         company_name:
 *           type: string
 *           description: Nombre de la empresa asociada al proveedor.
 *         supplier_type:
 *           type: string
 *           description: Tipo o categoría del proveedor (ej. "Mayorista", "Distribuidor").
 *         service_description:
 *           type: string
 *           description: Descripción detallada de los servicios o productos que ofrece el proveedor.
 *         geographic_coverage:
 *           type: string
 *           enum:
 *             - local
 *             - regional
 *             - national
 *           description: Área de cobertura geográfica del proveedor.
 *         operating_hours:
 *           type: string
 *           description: Horario de atención o de operaciones del proveedor.
 *         status:
 *           type: string
 *           enum:
 *             - active
 *             - inactive
 *             - suspended
 *           description: Estado actual del proveedor en la plataforma.
 *         average_rating:
 *           type: number
 *           format: float
 *           nullable: true
 *           description: Calificación promedio del proveedor basada en reseñas (0.00 - 5.00).
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Fecha de registro del proveedor.
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Fecha de la última actualización del perfil.
 *       example:
 *         id: "c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f"
 *         company_id: "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e"
 *         company_name: "Distribuidora El Sol S.A."
 *         supplier_type: "Mayorista"
 *         service_description: "Distribución de productos de consumo masivo, abarrotes y limpieza a nivel nacional."
 *         geographic_coverage: "Cobertura nacional: Tegucigalpa, San Pedro Sula y principales ciudades."
 *         operating_hours: "Lunes a Viernes 8:00 AM - 5:00 PM, Sábados 8:00 AM - 12:00 PM"
 *         status: "activo"
 *         average_rating: 4.5
 *         created_at: "2026-07-01T10:00:00.000Z"
 *         updated_at: "2026-07-10T15:30:00.000Z"
 *
 *     SupplierInput:
 *       type: object
 *       required:
 *         - company_id
 *         - supplier_type
 *         - supplier_description
 *         - geographic_coverage
 *         - operating_hours
 *       properties:
 *         company_id:
 *           type: string
 *           format: uuid
 *           description: UUID de la empresa a la que pertenecerá el proveedor. Debe existir en el sistema.
 *         supplier_type:
 *           type: string
 *           minLength: 2
 *           maxLength: 50
 *           description: Tipo o categoría del proveedor (ej. "Mayorista", "Fabricante", "Distribuidor").
 *         service_description:
 *           type: string
 *           minLength: 5
 *           description: Descripción de los servicios o productos que ofrece el proveedor.
 *         geographic_coverage:
 *           type: string
 *           enum:
 *             - local
 *             - regional
 *             - national
 *           description: Área de cobertura geográfica del proveedor.
 *         operating_hours:
 *           type: string
 *           minLength: 5
 *           maxLength: 150
 *           description: Horario de atención del proveedor.
 *       example:
 *         company_id: "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e"
 *         supplier_type: "Mayorista"
 *         service_description: "Distribución de productos de consumo masivo, abarrotes y limpieza a nivel nacional."
 *         geographic_coverage: "national"
 *         operating_hours: "Lunes a Viernes 8:00 AM - 5:00 PM"
 *
 *     SupplierUpdate:
 *       type: object
 *       description: >-
 *         Todos los campos son opcionales. Se actualizan únicamente los campos enviados.
 *         Al menos uno debe estar presente en el body.
 *       properties:
 *         supplier_type:
 *           type: string
 *           minLength: 2
 *           maxLength: 50
 *           description: Nuevo tipo o categoría del proveedor.
 *         service_description:
 *           type: string
 *           minLength: 5
 *           description: Nueva descripción de los servicios del proveedor.
 *         geographic_coverage:
 *           type: string
 *           enum:
 *             - local
 *             - regional
 *             - national
 *           description: Nueva área de cobertura geográfica del proveedor.
 *         operating_hours:
 *           type: string
 *           minLength: 5
 *           maxLength: 150
 *           description: Nuevo horario de atención.
 *       example:
 *         supplier_type: "Distribuidor Regional"
 *         geographic_coverage: "Cobertura ampliada: Honduras y El Salvador."
 *         operating_hours: "Lunes a Sábado 7:00 AM - 6:00 PM"
 *
 *     SupplierStatusUpdate:
 *       type: object
 *       required:
 *         - status
 *       description: >-
 *         Permite cambiar el estado del proveedor de forma aislada.
 *       properties:
 *         status:
 *           type: string
 *           enum:
 *             - active
 *             - inactive
 *             - suspended
 *           description: >-
 *             Nuevo estado del proveedor.
 *             active → inactive | suspended,
 *             inactive → active,
 *             suspended → active.
 *       example:
 *         status: "inactive"
 */

/**
 * @openapi
 * /api/v1/suppliers:
 *   post:
 *     summary: Registrar un nuevo proveedor
 *     description: >-
 *       Crea un perfil de proveedor vinculado a una empresa existente en el sistema.
 *       El proveedor hereda la identidad de la empresa y añade información operativa
 *       específica como tipo de servicio, cobertura geográfica y horarios.
 *     tags:
 *       - Proveedores
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SupplierInput'
 *     responses:
 *       201:
 *         description: Proveedor registrado exitosamente.
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
 *                   example: "Proveedor registrado exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/Supplier'
 *       400:
 *         description: Error de validación (Zod) o la empresa especificada no existe.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: No autenticado. Se requiere un Bearer token válido.
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
 *
 *   get:
 *     summary: Obtener listado de proveedores con filtros
 *     description: >-
 *       Recupera una lista paginada de proveedores registrados en la plataforma.
 *       Permite filtrar por estado y por empresa propietaria, y ordenar los
 *       resultados por cualquier campo permitido.
 *     tags:
 *       - Proveedores
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         description: Cantidad de registros por página (máximo 100).
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: "created_at"
 *         description: >-
 *           Campo por el cual ordenar. Campos permitidos: supplier_type,
 *           service_description, geographic_coverage, operating_hours,
 *           status, created_at, updated_at.
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum:
 *             - asc
 *             - desc
 *           default: "desc"
 *         description: Sentido del ordenamiento.
 *       - in: query
 *         name: company_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar proveedores pertenecientes a una empresa específica.
 *     responses:
 *       200:
 *         description: Listado de proveedores obtenido con éxito.
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
 *                   example: "Proveedores recuperados exitosamente"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Supplier'
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
  validateRequest(createSupplierSchema),
  supplierController.createSupplier,
);

router.get(
  "/",
  validateRequest(getSupplierSchema),
  supplierController.getSupplier,
);

/**
 * @openapi
 * /api/v1/suppliers/search:
 *   get:
 *     summary: Buscar proveedores por coincidencia de texto
 *     description: >-
 *       Realiza una búsqueda parcial (ILIKE) sobre el tipo de proveedor y la
 *       descripción de sus servicios. También evalúa la concatenación de ambos
 *       campos para mejorar los resultados. Los resultados son paginados.
 *     tags:
 *       - Proveedores
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 1
 *         description: Término de búsqueda para el tipo de proveedor o descripción de servicios.
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
 *           maximum: 200
 *         description: Cantidad de resultados por página (máximo 200).
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
 *                 message:
 *                   type: string
 *                   example: "Búsqueda de proveedores realizada con éxito"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Supplier'
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
 *                       example: 3
 *                     totalPages:
 *                       type: integer
 *                       example: 1
 *       400:
 *         description: Falta el parámetro requerido "query" o no cumple la longitud mínima.
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
router.get(
  "/search",
  validateRequest(searchSupplierSchema),
  supplierController.searchSupplier,
);

/**
 * @openapi
 * /api/v1/suppliers/{id}:
 *   get:
 *     summary: Obtener proveedor por ID
 *     description: Retorna la información completa de un proveedor a partir de su UUID v4.
 *     tags:
 *       - Proveedores
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID v4 identificador del proveedor.
 *     responses:
 *       200:
 *         description: Proveedor encontrado exitosamente.
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
 *                   example: "Proveedor encontrado exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/Supplier'
 *       400:
 *         description: Formato de ID inválido (no es un UUID v4 válido).
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
 *         description: El proveedor no existe en el sistema.
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
 *     summary: Actualizar proveedor (reemplazo parcial/completo)
 *     description: >-
 *       Actualiza de forma dinámica las propiedades enviadas en el body para
 *       el proveedor especificado. Al menos un campo debe ser enviado.
 *       El campo company_id (empresa propietaria) no es editable mediante este endpoint.
 *     tags:
 *       - Proveedores
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID v4 del proveedor a actualizar.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SupplierUpdate'
 *     responses:
 *       200:
 *         description: Proveedor actualizado exitosamente.
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
 *                   example: "Proveedor actualizado exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/Supplier'
 *       400:
 *         description: Parámetros inválidos, error de validación Zod o body vacío.
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
 *         description: El proveedor no fue encontrado.
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
  validateRequest(supplierIdParamsSchema),
  supplierController.getSupplierById,
);

router.put(
  "/:id",
  validateRequest(updateSupplierSchema),
  supplierController.updateSupplier,
);

/**
 * @openapi
 * /api/v1/suppliers/{id}/status:
 *   patch:
 *     summary: Cambiar el estado de un proveedor
 *     description: >-
 *       Permite actualizar de forma aislada el estado del proveedor.
 *       Úsalo para dar de baja lógica (inactivo), suspender (suspendido)
 *       o reactivar (activo) a un proveedor.
 *       Las transiciones de estado permitidas son:
 *       activo → inactivo | suspendido,
 *       inactivo → activo,
 *       suspendido → activo.
 *     tags:
 *       - Proveedores
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID v4 del proveedor al que se le cambiará el estado.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SupplierStatusUpdate'
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
 *                   example: "Estado del proveedor actualizado exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/Supplier'
 *       400:
 *         description: Estado inválido o transición de estado no permitida.
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
 *         description: El proveedor no existe.
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
router.patch(
  "/:id/status",
  validateRequest(changeStatusSchema),
  supplierController.changeSupplierStatus,
);

export default router;
