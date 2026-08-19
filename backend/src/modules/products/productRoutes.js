import { Router } from "express";
import * as ProductController from "../products/productController.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import { authenticate } from "../../middlewares/auth.middlewares.js";
import {
  createProductSchema,
  getProductsSchema,
  searchProductsSchema,
  productIdParamsSchema,
  updateProductSchema,
  changeStatusSchema,
  addProductImageSchema,
  deleteProductImageSchema,
} from "../products/productSchema.js";

const router = Router();

// Todos los endpoints de productos requieren autenticación
router.use(authenticate);

/**
 * @openapi
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       required:
 *         - id
 *         - supplier_id
 *         - category_id
 *         - name
 *         - description
 *         - price
 *         - currency
 *         - stock
 *         - unit_of_measure
 *         - brand
 *         - status
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: ID único autogenerado del producto (UUID v4).
 *         supplier_id:
 *           type: string
 *           format: uuid
 *           description: ID del proveedor propietario del producto.
 *         category_id:
 *           type: string
 *           format: uuid
 *           description: ID de la categoría a la que pertenece el producto.
 *         name:
 *           type: string
 *           description: Nombre comercial del producto.
 *         description:
 *           type: string
 *           description: Descripción detallada del producto.
 *         price:
 *           type: number
 *           format: float
 *           description: Precio unitario del producto.
 *           example: 299.99
 *         currency:
 *           type: string
 *           maxLength: 3
 *           description: Código ISO 4217 de la moneda (ej. HNL, USD, MXN).
 *           example: "HNL"
 *         stock:
 *           type: number
 *           description: Cantidad de unidades disponibles en inventario.
 *           example: 150
 *         unit_of_measure:
 *           type: string
 *           description: Unidad de medida del producto (ej. "unidad", "caja", "kg").
 *           example: "caja"
 *         brand:
 *           type: string
 *           description: Marca o fabricante del producto.
 *         model:
 *           type: string
 *           nullable: true
 *           description: Modelo específico del producto (opcional).
 *         status:
 *           type: string
 *           enum:
 *             - activo
 *             - agotado
 *             - disponible
 *             - no disponible
 *           description: Estado actual de disponibilidad del producto.
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Fecha de registro del producto.
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Fecha de la última actualización del producto.
 *       example:
 *         id: "d4e5f6a7-b8c9-0d1e-2f3a-4b5c6d7e8f9a"
 *         supplier_id: "c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f"
 *         category_id: "f3c9e2a1-4b87-4d56-b921-3e7f1a2c0d45"
 *         name: "Detergente en Polvo Premium"
 *         description: "Detergente de alta eficiencia para uso industrial, 10kg por caja."
 *         price: 299.99
 *         currency: "HNL"
 *         stock: 150
 *         unit_of_measure: "caja"
 *         brand: "LimpioMax"
 *         model: "LM-2000"
 *         status: "activo"
 *         created_at: "2026-07-01T10:00:00.000Z"
 *         updated_at: "2026-07-10T15:30:00.000Z"
 *
 *     ProductInput:
 *       type: object
 *       required:
 *         - supplier_id
 *         - category_id
 *         - name
 *         - description
 *         - price
 *         - currency
 *         - stock
 *         - unit_of_measure
 *         - brand
 *       properties:
 *         supplier_id:
 *           type: string
 *           format: uuid
 *           description: UUID del proveedor al que se vincula el producto. Debe existir en el sistema.
 *         category_id:
 *           type: string
 *           format: uuid
 *           description: UUID de la categoría del producto. Debe existir en el sistema.
 *         name:
 *           type: string
 *           minLength: 2
 *           maxLength: 150
 *           description: Nombre comercial del producto.
 *         description:
 *           type: string
 *           minLength: 2
 *           maxLength: 500
 *           description: Descripción detallada del producto.
 *         price:
 *           type: number
 *           format: float
 *           minimum: 0.01
 *           description: Precio unitario del producto (debe ser positivo).
 *         currency:
 *           type: string
 *           maxLength: 3
 *           description: Código ISO 4217 de la moneda (ej. HNL, USD).
 *         stock:
 *           type: number
 *           minimum: 1
 *           description: Cantidad de unidades disponibles (debe ser positivo).
 *         unit_of_measure:
 *           type: string
 *           minLength: 1
 *           maxLength: 20
 *           description: Unidad de medida del producto (ej. "unidad", "caja", "kg").
 *         brand:
 *           type: string
 *           minLength: 2
 *           maxLength: 150
 *           description: Marca o fabricante del producto.
 *         model:
 *           type: string
 *           nullable: true
 *           description: Modelo específico del producto (opcional).
 *       example:
 *         supplier_id: "c3d4e5f6-a7b8-9c0d-1e2f-3a4b5c6d7e8f"
 *         category_id: "f3c9e2a1-4b87-4d56-b921-3e7f1a2c0d45"
 *         name: "Detergente en Polvo Premium"
 *         description: "Detergente de alta eficiencia para uso industrial, 10kg por caja."
 *         price: 299.99
 *         currency: "HNL"
 *         stock: 150
 *         unit_of_measure: "caja"
 *         brand: "LimpioMax"
 *         model: "LM-2000"
 *
 *     ProductUpdate:
 *       type: object
 *       description: >-
 *         Todos los campos son opcionales. Se actualizan únicamente los campos enviados.
 *         Al menos uno debe estar presente en el body.
 *       properties:
 *         supplier_id:
 *           type: string
 *           format: uuid
 *           description: Nuevo UUID del proveedor (debe existir en el sistema).
 *         category_id:
 *           type: string
 *           format: uuid
 *           description: Nuevo UUID de la categoría (debe existir en el sistema).
 *         name:
 *           type: string
 *           minLength: 2
 *           maxLength: 150
 *           description: Nuevo nombre del producto.
 *         description:
 *           type: string
 *           minLength: 2
 *           maxLength: 500
 *           description: Nueva descripción del producto.
 *         price:
 *           type: number
 *           format: float
 *           minimum: 0.01
 *           description: Nuevo precio unitario.
 *         currency:
 *           type: string
 *           maxLength: 3
 *           description: Nuevo código de moneda ISO 4217.
 *         stock:
 *           type: number
 *           minimum: 1
 *           description: Nueva cantidad de unidades en stock.
 *         unit_of_measure:
 *           type: string
 *           minLength: 1
 *           maxLength: 20
 *           description: Nueva unidad de medida.
 *         brand:
 *           type: string
 *           minLength: 2
 *           maxLength: 150
 *           description: Nueva marca o fabricante.
 *         model:
 *           type: string
 *           nullable: true
 *           description: Nuevo modelo del producto.
 *       example:
 *         price: 349.99
 *         stock: 200
 *         description: "Detergente de alta eficiencia para uso industrial y doméstico, 10kg por caja."
 *
 *     ProductStatusUpdate:
 *       type: object
 *       required:
 *         - status
 *       description: >-
 *         Permite cambiar el estado de disponibilidad del producto de forma aislada.
 *       properties:
 *         status:
 *           type: string
 *           enum:
 *             - activo
 *             - agotado
 *             - disponible
 *             - no disponible
 *           description: >-
 *             Nuevo estado del producto.
 *             activo → agotado | no disponible | disponible.
 *             agotado → no disponible | disponible.
 *       example:
 *         status: "agotado"
 */

/**
 * @openapi
 * /api/v1/products:
 *   post:
 *     summary: Registrar un nuevo producto
 *     description: >-
 *       Crea un nuevo producto en el catálogo vinculado a un proveedor y una categoría
 *       existentes en el sistema. Valida que tanto el proveedor como la categoría
 *       existan antes de registrar el producto.
 *     tags:
 *       - Productos
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductInput'
 *     responses:
 *       201:
 *         description: Producto registrado correctamente.
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
 *                   example: "Producto registrado correctamente"
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *       400:
 *         description: >-
 *           Error de validación (Zod), el proveedor especificado no existe
 *           o la categoría especificada no existe.
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
 *     summary: Obtener listado de productos con filtros
 *     description: >-
 *       Recupera una lista paginada de productos del catálogo.
 *       Permite filtrar por proveedor, categoría y estado de disponibilidad,
 *       y ordenar los resultados por cualquier campo permitido.
 *     tags:
 *       - Productos
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
 *           Campo por el cual ordenar. Campos permitidos: name, description,
 *           price, currency, stock, unit_of_measure, brand, model,
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
 *         name: supplier_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar productos de un proveedor específico.
 *       - in: query
 *         name: category_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar productos de una categoría específica.
 *     responses:
 *       200:
 *         description: Listado de productos obtenido con éxito.
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
 *                   example: "Productos recuperados exitosamente"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
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
 *                       example: 128
 *                     totalPages:
 *                       type: integer
 *                       example: 13
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
  validateRequest(createProductSchema),
  ProductController.createProduct,
);

/**
 * @openapi
 * /products/mine:
 *   get:
 *     summary: Obtiene los productos del proveedor autenticado
 *     description: >
 *       Retorna únicamente los productos que pertenecen al proveedor
 *       cuyo perfil está asociado al usuario autenticado (derivado del JWT).
 *       No acepta ni confía en un supplier_id suministrado por el cliente.
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Catálogo del proveedor recuperado exitosamente.
 *       401:
 *         description: No autenticado.
 *       404:
 *         description: El usuario no tiene perfil de proveedor.
 */
router.get(
  "/mine",
  ProductController.getMyProducts,
);

router.get(
  "/",
  validateRequest(getProductsSchema),
  ProductController.getProducts,
);

/**
 * @openapi
 * /api/v1/products/search:
 *   get:
 *     summary: Buscar productos por coincidencia de texto
 *     description: >-
 *       Realiza una búsqueda parcial (ILIKE) sobre el nombre, la descripción
 *       y la marca del producto. Los resultados son paginados.
 *     tags:
 *       - Productos
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 1
 *         description: Término de búsqueda para el nombre, descripción o marca del producto.
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
 *         description: Cantidad de resultados por página (máximo 100).
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
 *                   example: "Búsqueda de productos realizada con éxito"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
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
 *                       example: 5
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
  validateRequest(searchProductsSchema),
  ProductController.searchProducts,
);

/**
 * @openapi
 * /api/v1/products/{id}:
 *   get:
 *     summary: Obtener producto por ID
 *     description: Retorna la información completa de un producto a partir de su UUID v4.
 *     tags:
 *       - Productos
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID v4 identificador del producto.
 *     responses:
 *       200:
 *         description: Producto encontrado exitosamente.
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
 *                   example: "Producto encontrado exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/Product'
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
 *         description: El producto no existe en el sistema.
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
 *     summary: Actualizar producto (reemplazo parcial/completo)
 *     description: >-
 *       Actualiza de forma dinámica las propiedades enviadas en el body para
 *       el producto especificado. Valida que el nuevo supplier_id y category_id
 *       existan en el sistema si son enviados. Al menos un campo debe ser enviado.
 *     tags:
 *       - Productos
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID v4 del producto a actualizar.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductUpdate'
 *     responses:
 *       200:
 *         description: Producto actualizado correctamente.
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
 *                   example: "Producto actualizado correctamente"
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *       400:
 *         description: >-
 *           Parámetros inválidos, error de validación Zod, body vacío,
 *           o el proveedor/categoría especificado no existe.
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
 *         description: El producto no fue encontrado.
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
 *   patch:
 *     summary: Modificar parcialmente los campos de un producto
 *     description: >-
 *       Modifica de manera parcial los campos del producto. Comparte la misma
 *       lógica y validaciones que el endpoint PUT. Al menos un campo debe enviarse
 *       en el body.
 *     tags:
 *       - Productos
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID v4 del producto a modificar.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductUpdate'
 *     responses:
 *       200:
 *         description: Producto modificado con éxito.
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
 *                   example: "Producto actualizado correctamente"
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *       400:
 *         description: Parámetros inválidos, body vacío o proveedor/categoría no encontrado.
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
 *         description: Producto no encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Error de servidor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/:id",
  validateRequest(productIdParamsSchema),
  ProductController.getProductById,
);

router.put(
  "/:id",
  validateRequest(updateProductSchema),
  ProductController.updateProduct,
);

router.patch(
  "/:id",
  validateRequest(updateProductSchema),
  ProductController.updateProduct,
);

/**
 * @openapi
 * /api/v1/products/{id}/status:
 *   patch:
 *     summary: Cambiar el estado de disponibilidad de un producto
 *     description: >-
 *       Permite actualizar de forma aislada el estado de disponibilidad del producto.
 *       Las transiciones de estado permitidas son:
 *       activo → agotado | no disponible | disponible,
 *       agotado → no disponible | disponible,
 *       no_disponible → agotado | disponible,
 *       disponible → agotado | no disponible.
 *     tags:
 *       - Productos
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID v4 del producto al que se le cambiará el estado.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductStatusUpdate'
 *     responses:
 *       200:
 *         description: Estado de disponibilidad actualizado correctamente.
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
 *                   example: "Estado de producto actualizado correctamente"
 *                 data:
 *                   $ref: '#/components/schemas/Product'
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
 *         description: El producto no existe.
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
  ProductController.changeProductStatus,
);

router.delete(
  "/:id",
  validateRequest(productIdParamsSchema),
  ProductController.deleteProduct,
);

router.get(
  "/:id/images",
  validateRequest(productIdParamsSchema),
  ProductController.getProductImages,
);

router.post(
  "/:id/images",
  validateRequest(addProductImageSchema),
  ProductController.addProductImage,
);

router.delete(
  "/:id/images/:imageId",
  validateRequest(deleteProductImageSchema),
  ProductController.deleteProductImage,
);

export default router;

