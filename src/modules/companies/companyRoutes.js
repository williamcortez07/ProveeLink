import { Router } from "express";
import * as companyController from "../companies/companyController.js";
import { validateRequest } from "../../middlewares/validateRequest.js";
import { authenticate } from "../../middlewares/auth.middlewares.js";
import {
  createCompanySchema,
  getCompaniesSchema,
  searchCompaniesSchema,
  companyIdParamSchema,
  updateCompanySchema,
} from "../companies/companySchema.js";

const router = Router();

// Todos los endpoints de empresas requieren autenticación
router.use(authenticate);

/**
 * @openapi
 * components:
 *   schemas:
 *     Company:
 *       type: object
 *       required:
 *         - id
 *         - user_id
 *         - name
 *         - phone
 *         - email
 *         - address
 *         - state_province
 *         - city
 *         - verification_status
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: ID único autogenerado de la empresa (UUID v4).
 *         user_id:
 *           type: string
 *           format: uuid
 *           description: ID del usuario propietario/responsable de la empresa.
 *         name:
 *           type: string
 *           description: Nombre comercial de la empresa.
 *         description:
 *           type: string
 *           nullable: true
 *           description: Descripción opcional de la empresa.
 *         tax_id:
 *           type: string
 *           nullable: true
 *           description: Número de identificación fiscal (RUC, NIT, RFC, etc.).
 *         phone:
 *           type: string
 *           description: Teléfono de contacto de la empresa.
 *         email:
 *           type: string
 *           format: email
 *           description: Correo electrónico único de la empresa.
 *         address:
 *           type: string
 *           description: Dirección física de la empresa.
 *         state_province:
 *           type: string
 *           description: Estado, provincia o departamento donde se ubica la empresa.
 *         city:
 *           type: string
 *           description: Ciudad donde se ubica la empresa.
 *         logo_url:
 *           type: string
 *           format: uri
 *           nullable: true
 *           description: URL del logotipo de la empresa.
 *         website_url:
 *           type: string
 *           format: uri
 *           nullable: true
 *           description: URL del sitio web de la empresa.
 *         verification_status:
 *           type: string
 *           description: Estado de verificación de la empresa en el sistema.
 *           example: "pending"
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Fecha de registro de la empresa.
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Fecha de la última actualización de los datos de la empresa.
 *       example:
 *         id: "b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e"
 *         user_id: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d"
 *         name: "Distribuidora El Sol S.A."
 *         description: "Empresa dedicada a la distribución de productos de consumo masivo."
 *         tax_id: "J-40123456-7"
 *         phone: "+50422334455"
 *         email: "contacto@distribuidoraelsol.com"
 *         address: "Colonia Palmira, Edificio Torre Empresarial, Piso 3"
 *         state_province: "Francisco Morazán"
 *         city: "Tegucigalpa"
 *         logo_url: "https://storage.api.com/logos/elsol.png"
 *         website_url: "https://www.distribuidoraelsol.com"
 *         verification_status: "pending"
 *         created_at: "2026-07-01T10:00:00.000Z"
 *         updated_at: "2026-07-08T15:30:00.000Z"
 *
 *     CompanyInput:
 *       type: object
 *       required:
 *         - user_id
 *         - name
 *         - phone
 *         - email
 *         - address
 *         - state_province
 *         - city
 *       properties:
 *         user_id:
 *           type: string
 *           format: uuid
 *           description: UUID del usuario propietario/responsable de la empresa. Debe existir en el sistema.
 *         name:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *           description: Nombre comercial de la empresa.
 *         description:
 *           type: string
 *           description: Descripción opcional de la actividad o giro de la empresa.
 *         tax_id:
 *           type: string
 *           description: Número de identificación fiscal (RUC, NIT, RFC, etc.). Opcional.
 *         phone:
 *           type: string
 *           description: Teléfono de contacto. Formato internacional aceptado (ej. +50422334455).
 *         email:
 *           type: string
 *           format: email
 *           description: Correo electrónico único de la empresa.
 *         address:
 *           type: string
 *           minLength: 5
 *           description: Dirección física de la empresa.
 *         state_province:
 *           type: string
 *           minLength: 5
 *           description: Estado, provincia o departamento de la empresa.
 *         city:
 *           type: string
 *           minLength: 5
 *           description: Ciudad de la empresa.
 *         logo_url:
 *           type: string
 *           format: uri
 *           nullable: true
 *           description: URL del logotipo. Puede enviarse null o simplemente omitirse.
 *         website_url:
 *           type: string
 *           format: uri
 *           nullable: true
 *           description: URL del sitio web. Puede enviarse null o simplemente omitirse.
 *       example:
 *         user_id: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d"
 *         name: "Distribuidora El Sol S.A."
 *         description: "Empresa dedicada a la distribución de productos de consumo masivo."
 *         tax_id: "J-40123456-7"
 *         phone: "+50422334455"
 *         email: "contacto@distribuidoraelsol.com"
 *         address: "Colonia Palmira, Edificio Torre Empresarial, Piso 3"
 *         state_province: "Francisco Morazán"
 *         city: "Tegucigalpa"
 *         logo_url: null
 *         website_url: "https://www.distribuidoraelsol.com"
 *
 *     CompanyUpdate:
 *       type: object
 *       description: >-
 *         Todos los campos son opcionales. Se actualizan únicamente los campos enviados.
 *         Al menos uno debe estar presente en el body. El campo user_id (propietario)
 *         no es editable mediante este endpoint.
 *       properties:
 *         name:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *           description: Nuevo nombre comercial de la empresa.
 *         description:
 *           type: string
 *           description: Nueva descripción de la empresa.
 *         tax_id:
 *           type: string
 *           description: Nuevo número de identificación fiscal (RUC, NIT, RFC, etc.).
 *         phone:
 *           type: string
 *           description: Nuevo teléfono de contacto. Formato internacional aceptado.
 *         email:
 *           type: string
 *           format: email
 *           description: Nuevo correo electrónico (debe ser único en el sistema).
 *         address:
 *           type: string
 *           minLength: 5
 *           description: Nueva dirección física.
 *         state_province:
 *           type: string
 *           minLength: 5
 *           description: Nuevo estado/provincia/departamento.
 *         city:
 *           type: string
 *           minLength: 5
 *           description: Nueva ciudad.
 *         logo_url:
 *           type: string
 *           format: uri
 *           nullable: true
 *           description: Nueva URL del logotipo. Enviar null para eliminarlo.
 *         website_url:
 *           type: string
 *           format: uri
 *           nullable: true
 *           description: Nueva URL del sitio web. Enviar null para eliminarlo.
 *       example:
 *         name: "Distribuidora El Sol Internacional S.A."
 *         email: "info@distribuidoraelsol.com"
 *         phone: "+50499887766"
 *         address: "Colonia Palmira, Torre Empresarial, Piso 5"
 *         state_province: "Francisco Morazán"
 *         city: "Tegucigalpa"
 *         logo_url: "https://storage.api.com/logos/elsol_v2.png"
 *         website_url: "https://www.distribuidoraelsol.com"
 */

/**
 * @openapi
 * /api/v1/companies:
 *   post:
 *     summary: Registrar una nueva empresa
 *     description: >-
 *       Crea una nueva empresa en el sistema vinculada a un usuario existente.
 *       Valida que el usuario especificado exista y que el correo electrónico
 *       no esté registrado previamente.
 *     tags:
 *       - Empresas
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CompanyInput'
 *     responses:
 *       201:
 *         description: Empresa registrada exitosamente.
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
 *                   example: "Empresa registrada exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/Company'
 *       400:
 *         description: Error de validación (Zod) o el usuario especificado no existe.
 *       409:
 *         description: Conflicto - El correo electrónico ya está registrado por otra empresa.
 *       500:
 *         description: Error interno del servidor.
 *
 *   get:
 *     summary: Obtener listado de empresas con filtros
 *     description: >-
 *       Recupera una lista paginada de empresas de la base de datos.
 *       Permite filtrar por estado de verificación y por usuario responsable,
 *       así como ordenar los resultados por cualquier campo permitido.
 *     tags:
 *       - Empresas
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
 *           default: 20
 *           maximum: 200
 *         description: Cantidad de registros por página (máximo 200).
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           default: "created_at"
 *         description: >-
 *           Campo por el cual ordenar los resultados. Campos permitidos: name,
 *           description, tax_id, phone, email, address, state_province, city,
 *           logo_url, website_url, verification_status, created_at, updated_at.
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
 *         name: status
 *         schema:
 *           type: string
 *           enum:
 *             - active
 *             - inactive
 *             - suspended
 *             - pending
 *         description: Filtrar empresas por su estado de verificación.
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar empresas pertenecientes a un usuario específico.
 *     responses:
 *       200:
 *         description: Listado de empresas obtenido con éxito.
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
 *                   example: "Empresas recuperadas exitosamente"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Company'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     pageSize:
 *                       type: integer
 *                       example: 20
 *                     totalItems:
 *                       type: integer
 *                       example: 85
 *                     totalPages:
 *                       type: integer
 *                       example: 5
 *       500:
 *         description: Error interno del servidor.
 */
router.post(
  "/",
  validateRequest(createCompanySchema),
  companyController.createCompany,
);
router.get(
  "/",
  validateRequest(getCompaniesSchema),
  companyController.getCompanies,
);

/**
 * @openapi
 * /api/v1/companies/search:
 *   get:
 *     summary: Buscar empresas por coincidencia de texto
 *     description: >-
 *       Realiza una búsqueda parcial (ILIKE) sobre el nombre y la descripción de las empresas.
 *       También evalúa la concatenación de ambos campos para mejorar los resultados.
 *       Los resultados son paginados.
 *     tags:
 *       - Empresas
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 1
 *         description: Término o texto de búsqueda para el nombre o descripción de la empresa.
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
 *           default: 20
 *           maximum: 200
 *         description: Cantidad de resultados por página.
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
 *                   example: "Búsqueda de empresas realizada con éxito"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Company'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     pageSize:
 *                       type: integer
 *                       example: 20
 *                     totalItems:
 *                       type: integer
 *                       example: 4
 *                     totalPages:
 *                       type: integer
 *                       example: 1
 *       400:
 *         description: Falta el parámetro requerido "query" o no cumple la longitud mínima.
 *       500:
 *         description: Error interno del servidor.
 */
router.get(
  "/search",
  validateRequest(searchCompaniesSchema),
  companyController.searchCompanies,
);

/**
 * @openapi
 * /api/v1/companies/{id}:
 *   get:
 *     summary: Obtener empresa por ID
 *     description: Retorna la información completa de una empresa a partir de su UUID v4.
 *     tags:
 *       - Empresas
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID v4 identificador de la empresa.
 *     responses:
 *       200:
 *         description: Empresa encontrada exitosamente.
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
 *                   example: "Empresa encontrada exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/Company'
 *       400:
 *         description: Formato de ID inválido (no es un UUID v4 válido).
 *       404:
 *         description: La empresa no existe en el sistema.
 *       500:
 *         description: Error interno del servidor.
 *
 *   put:
 *     summary: Actualizar empresa (reemplazo parcial/completo)
 *     description: >-
 *       Actualiza de forma dinámica las propiedades enviadas en el cuerpo para
 *       la empresa especificada. Valida que el nuevo email no esté en uso y que
 *       el nuevo user_id exista en el sistema. Al menos un campo debe ser enviado.
 *     tags:
 *       - Empresas
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID v4 de la empresa a actualizar.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CompanyUpdate'
 *     responses:
 *       200:
 *         description: Empresa actualizada exitosamente.
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
 *                   example: "Empresa actualizada exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/Company'
 *       400:
 *         description: >-
 *           Parámetros inválidos, error de validación Zod, body vacío,
 *           o el usuario especificado no existe.
 *       404:
 *         description: La empresa no fue encontrada.
 *       409:
 *         description: Conflicto - El correo electrónico ya está registrado por otra empresa.
 *       500:
 *         description: Error interno del servidor.
 *
 *   patch:
 *     summary: Modificar parcialmente los campos de una empresa
 *     description: >-
 *       Modifica de manera parcial los campos de la empresa. Comparte la misma
 *       lógica y validaciones que el endpoint PUT. Al menos un campo debe enviarse
 *       en el body.
 *     tags:
 *       - Empresas
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID v4 de la empresa a modificar.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CompanyUpdate'
 *     responses:
 *       200:
 *         description: Empresa modificada con éxito.
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
 *                   example: "Empresa actualizada exitosamente"
 *                 data:
 *                   $ref: '#/components/schemas/Company'
 *       400:
 *         description: Parámetros inválidos, body vacío o usuario no encontrado.
 *       404:
 *         description: Empresa no encontrada.
 *       409:
 *         description: El correo electrónico ya está registrado.
 *       500:
 *         description: Error de servidor.
 */
router.get(
  "/:id",
  validateRequest(companyIdParamSchema),
  companyController.getCompanyById,
);

router.put(
  "/:id",
  validateRequest(updateCompanySchema),
  companyController.updateCompany,
);

router.patch(
  "/:id",
  validateRequest(updateCompanySchema),
  companyController.updateCompany,
);

export default router;
