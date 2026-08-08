# ProveeLink

<div align="center">

![Version](https://img.shields.io/badge/versión-1.0.0-blue.svg?style=for-the-badge)
![Status](https://img.shields.io/badge/estado-En%20Desarrollo-orange.svg?style=for-the-badge)
![License](https://img.shields.io/badge/licencia-MIT-green.svg?style=for-the-badge)
![NodeJS](https://img.shields.io/badge/Node.js-v20%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-v5.2-000000?style=for-the-badge&logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-v16%2B-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Storage-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Progressive%20Web%20App-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)
![Swagger](https://img.shields.io/badge/OpenAPI-3.0-85EA2D?style=for-the-badge&logo=swagger&logoColor=black)

### Plataforma Web Progresiva (PWA) para la Gestión, Conexión y Consulta de Proveedores Nacionales

</div>

---

## Tabla de Contenido

1. [Descripción General](#1-descripción-general)
2. [Objetivos del Proyecto](#2-objetivos-del-proyecto)
3. [Alcance](#3-alcance)
4. [Arquitectura del Sistema](#4-arquitectura-del-sistema)
5. [Diseño del Sistema](#5-diseño-del-sistema)
6. [Tecnologías Utilizadas](#6-tecnologías-utilizadas)
7. [Arquitectura Multicapa](#7-arquitectura-multicapa)
8. [Estructura del Proyecto](#8-estructura-del-proyecto)
9. [Requisitos Técnicos](#9-requisitos-técnicos)
10. [Instalación](#10-instalación)
11. [Configuración](#11-configuración)
12. [Ejecución del Proyecto](#12-ejecución-del-proyecto)
13. [Base de Datos](#13-base-de-datos)
14. [API REST & Documentación Swagger](#14-api-rest--documentación-swagger)
15. [Almacenamiento de Imágenes](#15-almacenamiento-de-imágenes)
16. [Estructura de Codificación](#16-estructura-de-codificación)
17. [Convenciones de Desarrollo](#17-convenciones-de-desarrollo)
18. [Seguridad](#18-seguridad)
19. [Manual de Despliegue](#19-manual-de-despliegue)
20. [Mantenimiento](#20-mantenimiento)
21. [Contribución](#21-contribución)
22. [Créditos](#22-créditos)

---

## 1. Descripción General

**ProveeLink** es una Plataforma Web Progresiva (PWA) de alto rendimiento diseñada para impulsar el ecosistema comercial conectando de forma directa y eficiente a emprendedores, micro, pequeñas y medianas empresas (MIPYMES) con proveedores nacionales de productos, materias primas, maquinaria industrial y servicios profesionales.

La plataforma centraliza un directorio auditado de empresas proveedoras, ofreciendo mecanismos avanzados de búsqueda parametrizada, filtrado inteligente por categorías y rubros, comparación de productos, emisión de solicitudes de cotización y gestión de perfiles corporativos mediante una interfaz moderna, responsive y orientada a la experiencia de usuario (UX/UI).

Técnicamente, **ProveeLink** adopta un desacoplamiento total entre el cliente y el servidor mediante una **API RESTful** fundamentada en **Node.js (ES Modules)** y **Express**, un sistema de base de datos relacional sobre **PostgreSQL**, almacenamiento de activos multimedia gestionado en **Supabase Storage**, y un cliente frontend modular PWA con soporte para Service Workers, Cache API y comunicación asíncrona segura.

---

## 2. Objetivos del Proyecto

### Objetivo General

Desarrollar e implementar una plataforma web progresiva (PWA) robusta, segura y escalable que optimice la cadena de suministros para MIPYMES mediante la localización, evaluación y contacto directo con proveedores confiables a nivel nacional.

### Objetivos Específicos

- **Centralización de Información:** Consolidar en un catálogo estructurado la oferta nacional de proveedores, empresas y productos.
- **Búsqueda Avanzada:** Implementar algoritmos de filtrado multicriterio (categoría, ubicación, tipo de proveedor, palabra clave).
- **Gestión Integral de Catálogos:** Ofrecer herramientas a las empresas para publicar, actualizar y categorizar sus productos y servicios.
- **Seguridad y Control de Acceso:** Garantizar la integridad mediante autenticación basada en JWT, verificación OTP por correo electrónico y RBAC (Control de Acceso Basado en Roles).
- **Experiencia Multiplataforma (PWA):** Permitir la instalación del cliente web en dispositivos móviles y de escritorio con tiempos de carga optimizados.
- **Transparencia Comercial:** Facilitar mecanismos de evaluación, favoritos y contacto transparente entre compradores y proveedores.

---

## 3. Alcance

El sistema está estructurado modularmente en torno a los siguientes dominios funcionales:

| Módulo | Descripción Funcional |
| :--- | :--- |
| **Auth** | Registro de usuarios, verificación mediante OTP enviado por SMTP, inicio de sesión seguro, silent refresh de tokens JWT y recuperación de credenciales. |
| **Users** | Administración de cuentas de usuario, actualización de datos personales, estados (activo/inactivo/pendiente) y asignación de roles. |
| **Roles** | Matriz de permisos y definición de roles del sistema (`ADMIN`, `SUPPLIER`, `CUSTOMER`). |
| **Companies** | Perfiles corporativos de empresas, registro de marca, logotipo, información fiscal/comercial y ubicación. |
| **Suppliers** | Ficha detallada de proveedores nacionales, rubros de atención, catálogo asociado y certificación comercial. |
| **Products** | Gestión del catálogo de productos, materias primas y servicios con precios, especificaciones técnicas e imágenes subidas a Supabase. |
| **Categories** | Taxonomía y clasificación jerárquica de rubros comerciales y categorías de productos. |
| **Comments** | Sistema de comentarios, valoraciones y retroalimentación comercial entre empresas. |
| **Favorites** | Marcado y seguimiento de proveedores y productos preferidos por parte de los clientes. |
| **Dashboard** | Panel interactivo de métricas y resumen de actividad según el rol del usuario autenticado. |

---

## 4. Arquitectura del Sistema

El sistema implementa una arquitectura **Cliente-Servidor Desacoplada** basada en servicios RESTful y comunicación asíncrona mediante JSON sobre HTTPS.

```text
                               ┌──────────────────────────────────────────┐
                               │             USUARIO / CLIENTE            │
                               └────────────────────┬─────────────────────┘
                                                    │
                                                    ▼
                               ┌──────────────────────────────────────────┐
                               │   Frontend Progressive Web App (PWA)     │
                               │   HTML5 • CSS3 Moderno • JavaScript ES6+ │
                               │   Service Worker • Cache API • Router UI │
                               └────────────────────┬─────────────────────┘
                                                    │
                                          HTTP / HTTPS (REST API)
                                            Bearer JWT Auth
                                                    │
                                                    ▼
                               ┌──────────────────────────────────────────┐
                               │          Backend REST API (Node.js)      │
                               │  Express 5 • Zod Validation • Pino Logs  │
                               └───────────┬──────────────────┬───────────┘
                                           │                  │
                    ┌──────────────────────┘                  └──────────────────────┐
                    ▼                                                                ▼
   ┌────────────────────────────────┐                               ┌────────────────────────────────┐
   │       Base de Datos (PG)       │                               │       Supabase Storage         │
   │ PostgreSQL 16+ (pg Connection Pool)                            │  Almacenamiento de Logos,      │
   │ Integridad Referencial / SQL   │                               │  Imágenes y Documentos         │
   └────────────────────────────────┘                               └────────────────────────────────┘
```

---

## 5. Diseño del Sistema

La capa frontend sigue un enfoque **Modular Basado en Componentes y Servicios**, prescindiendo de dependencias pesadas para asegurar el máximo rendimiento de la PWA.

### Componentes Principales

- **Router Client-Side (`js/services/routes.js`):** Intercepta la navegación, valida los permisos del rol en sesión y carga las vistas de forma dinámica.
- **Service Layer (`js/services/api.js`):** Cliente HTTP centralizado con manejo automático de headers de autorización JWT, reintentos e intercepción de errores.
- **Supabase Integration (`js/services/supabase.js`):** Cliente de almacenamiento remoto para la subida asíncrona de archivos multimedia desde la UI.
- **Notification Manager (`js/services/notificationService.js`):** Sistema global de notificaciones, toasts y modales de confirmación interactivos.
- **Design Tokens & Core UI (`css/`):** Variables CSS reutilizables para colores, tipografías, sombreados, animaciones y diseño responsivo *mobile-first*.

---

## 6. Tecnologías Utilizadas

### Frontend
- **HTML5 Semantic Standard** para estructura accesible.
- **CSS3 / Vanilla CSS** con variables personalizadas (*Design Tokens*), Flexbox y CSS Grid.
- **JavaScript Moderno (ES6+)** con sintaxis de módulos nativos (`import`/`export`).
- **Fetch API** para llamadas HTTP asíncronas.
- **Service Workers & Web Manifest** para capacidades PWA e instalación en dispositivos.
- **LocalStorage & SessionStorage** para la persistencia segura del estado de la sesión.

### Backend
- **Node.js (v20+)** como entorno de ejecución (ES Modules `"type": "module"`).
- **Express.js (v5.2+)** para el ruteo y servidor HTTP.
- **Zod (v3.23+)** para la validación estricta de esquemas de datos de entrada y variables de entorno.
- **JSON Web Token (JWT)** para la autenticación sin estado (*stateless*).
- **bcrypt / bcryptjs** para el hashing seguro de contraseñas.
- **Pino (v9.0+)** para el registro de logs estructurados de alto rendimiento.
- **Nodemailer (v9.0+)** para el envío de correos electrónicos transaccionales y códigos OTP.
- **Swagger UI Express & Swagger JSDoc** para la generación automática de la documentación de la API (OpenAPI 3.0).

### Base de Datos y Almacenamiento
- **PostgreSQL (v16+)** como gestor de base de datos relacional con `pg` Connection Pool.
- **Supabase Storage** para la persistencia y distribución CDN de imágenes.

---

## 7. Arquitectura Multicapa

El servidor backend cumple estrictamente con el patrón de **Diseño en Capas (Layered Architecture)**, separando de manera clara e independiente las responsabilidades de cada componente:

```text
                            Petición HTTP / REST Client
                                        │
                                        ▼
                            ┌───────────────────────┐
                            │    Rutas (Routes)     │
                            └───────────┬───────────┘
                                        │
                                        ▼
                            ┌───────────────────────┐
                            │ Middlewares & Zod     │  ◄── Validaciones de Entrada y Auth JWT
                            └───────────┬───────────┘
                                        │
                                        ▼
                            ┌───────────────────────┐
                            │     Controladores     │  ◄── Gestión de HTTP Status y Respuestas
                            └───────────┬───────────┘
                                        │
                                        ▼
                            ┌───────────────────────┐
                            │  Servicios (Services) │  ◄── Reglas de Negocio y Orquestación
                            └───────────┬───────────┘
                                        │
                                        ▼
                            ┌───────────────────────┐
                            │ Repositorios (Data)   │  ◄── Consultas SQL Parametrizadas
                            └───────────┬───────────┘
                                        │
                                        ▼
                            ┌───────────────────────┐
                            │ Base de Datos Postgres│
                            └───────────────────────┘
```

1. **Rutas (`*.routes.js`):** Exponen los endpoints de la API REST y vinculan los middlewares de autorización y validación con sus respectivos controladores.
2. **Middlewares (`middlewares/`):** Validan la autenticidad de las solicitudes (`auth.middlewares.js`), ejecutan los esquemas de validación Zod (`validateRequest.js`) y capturan excepciones de forma centralizada (`errorHandler.js`).
3. **Controladores (`*Controller.js` / `*.controller.js`):** Reciben la petición Express, extraen los parámetros y devuelven respuestas HTTP estandarizadas en formato JSON.
4. **Servicios (`*Service.js` / `*.service.js`):** Contienen la lógica de negocio pura, validaciones de reglas del dominio y coordinación de repositorios.
5. **Repositorios (`*Repository.js` / `*.repository.js`):** Ejecutan las operaciones de lectura y escritura en PostgreSQL mediante consultas SQL nativas y seguras contra Inyección SQL.

---

## 8. Estructura del Proyecto

La estructura física de archivos del proyecto refleja fielmente la organización modular descrita:

```text
ProveeLink/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js                     # Pool de conexiones a PostgreSQL
│   │   │   ├── environment.js            # Validación de variables de entorno con Zod
│   │   │   ├── nomenclatura.md           # Guía interna de convenciones de código
│   │   │   └── swagger.js                # Configuración de OpenAPI 3.0 / Swagger UI
│   │   ├── constants/
│   │   │   └── roles.js                  # Definición de IDs y constantes de roles
│   │   ├── middlewares/
│   │   │   ├── auth.middlewares.js       # Verificación de Tokens JWT y permisos RBAC
│   │   │   ├── errorHandler.js           # Manejador global de errores
│   │   │   └── validateRequest.js        # Middleware de validación con Zod
│   │   ├── modules/
│   │   │   ├── auth/                     # Módulo de Autenticación y OTP
│   │   │   │   ├── auth.controller.js
│   │   │   │   ├── auth.repository.js
│   │   │   │   ├── auth.routes.js
│   │   │   │   ├── auth.schema.js
│   │   │   │   └── auth.service.js
│   │   │   ├── categories/               # Módulo de Categorías
│   │   │   ├── comments/                 # Módulo de Comentarios
│   │   │   ├── companies/                # Módulo de Empresas
│   │   │   ├── products/                 # Módulo de Productos
│   │   │   ├── roles/                    # Módulo de Roles
│   │   │   ├── suppliers/                # Módulo de Proveedores
│   │   │   └── users/                    # Módulo de Usuarios
│   │   ├── utils/
│   │   │   ├── AppError.js               # Clase personalizada para errores operacionalizables
│   │   │   ├── asyncWrapper.js           # Wrapper para captura de promesas en controladores
│   │   │   ├── jwt.js                    # Utilidades de firma y verificación JWT
│   │   │   ├── logger.js                 # Instancia de registrador de logs con Pino
│   │   │   └── mailer.js                 # Servicio de envío de correos con Nodemailer
│   │   ├── app.js                        # Configuración e inicialización de Express
│   │   └── server.js                     # Punto de entrada y arranque del servidor HTTP
│   ├── .env.example                      # Plantilla de configuración de variables de entorno
│   ├── package.json                      # Dependencias y scripts de backend
│   └── package-lock.json
│
├── frontend/
│   ├── assets/                           # Recursos gráficos, íconos y logotipos
│   ├── css/                              # Hoja de estilos principal y módulos CSS
│   ├── js/
│   │   ├── services/
│   │   │   ├── api.js                    # Cliente API Fetch reutilizable
│   │   │   ├── authService.js            # Servicio cliente de autenticación
│   │   │   ├── notificationService.js    # Notificaciones UI (Toasts / Modales)
│   │   │   ├── routes.js                 # Enrutador cliente y protección de páginas
│   │   │   ├── storageService.js         # Abstracción de LocalStorage/SessionStorage
│   │   │   └── supabase.js               # Integración del SDK de Supabase Storage
│   │   ├── company/                          # Controladores JS para módulo de empresas
│   │   ├── customer/                         # Controladores JS para módulo de cliente
│   │   ├── supplier/                         # Controladores JS para módulo de proveedor
│   │   ├── utils/                            # Funciones auxiliares del cliente
│   │   ├── auth.js                           # Control de formularios de Auth y OTP
│   │   ├── categories.js                     # Renderizado de categorías
│   │   ├── home.js                           # Lógica del dashboard y pantalla principal
│   │   └── profile.js                        # Gestión del perfil de usuario
│   ├── pages/
│   │   ├── company/                          # Vistas de administración de empresas
│   │   ├── components/                       # Componentes HTML parciales (Sidebar, Header)
│   │   ├── supplier/                         # Vistas de gestión para proveedores
│   │   ├── category.html                     # Vista de directorio de categorías
│   │   ├── categoryInfo.html                 # Vista detallada de categoría
│   │   ├── favorites.html                    # Vista de elementos guardados
│   │   ├── home.html                         # Vista del panel principal / Dashboard
│   │   └── profile.html                      # Vista de gestión de perfil
│   ├── index.html                        # Punto de entrada de la SPA / PWA
│   ├── manifest.json                     # Manifiesto Web de la PWA
│   └── sw.js                             # Service Worker de la PWA
│
├── database/
│   └── squema/                           # Contenedor de scripts SQL de definición e inicialización
│
└── README.md                             # Documentación técnica oficial del proyecto
```

---

## 9. Requisitos Técnicos

### Entorno de Desarrollo y Ejecución

- **Node.js:** Versión `20.x` LTS o superior.
- **Gestor de Paquetes:** `npm` v10.x o superior.
- **Base de Datos:** PostgreSQL v16.x instanciado localmente o mediante contenedor Docker.
- **Navegadores Compatibles:** Google Chrome (v110+), Mozilla Firefox (v110+), Microsoft Edge (v110+), Apple Safari (v16+).
- **Sistemas Operativos Soportados:** Microsoft Windows 10/11, Linux (Ubuntu/Debian/Fedora), macOS (12+).

---

## 10. Instalación

### 1. Clonar el Repositorio

```bash
git clone https://github.com/williamcortez07/ProveeLink.git
cd ProveeLink
```

### 2. Instalación del Backend

```bash
cd backend
npm install
```

### 3. Configuración del Frontend

El cliente frontend está construido con tecnologías web estándares y no requiere un proceso de transpilación o compilación. Se recomienda servir la carpeta `frontend/` con un servidor de archivos estáticos (ej. `npx serve`, `Live Server` en VS Code o Nginx).

---

## 11. Configuración

Cree un archivo `.env` dentro del directorio `backend/src/.env` (o en la raíz del proyecto backend según el entorno de ejecución). Puede tomar como referencia la siguiente estructura validada con **Zod**:

```env
# ── SERVIDOR ──────────────────────────────────────────────────
PORT=3000
NODE_ENV=development

# ── BASE DE DATOS (PostgreSQL) ───────────────────────────────
DB_HOST=localhost
DB_PORT=5434
DB_USER=postgres
DB_PASSWORD=TuPasswordSeguro
DB_NAME=proveeLinkDev
DB_SSL_REJECT_UNAUTHORIZED=1

# ── AUTENTICACIÓN (JWT) ───────────────────────────────────────
# Debe ser una firma aleatoria de al menos 32 caracteres
JWT_SECRET=clave_super_secreta_minimo_32_caracteres
JWT_EXPIRES_IN=24h

# ── SERVICIO DE CORREO (SMTP / Nodemailer) ────────────────────
MAIL_HOST=smtp.gmail.com
MAIL_PORT=465
MAIL_SECURE=true
MAIL_USER=tu_correo@gmail.com
MAIL_PASS=tu_contraseña_de_aplicacion
MAIL_FROM=tu_correo@gmail.com

# ── SEGURIDAD Y CORS ──────────────────────────────────────────
# Permita orígenes específicos separados por coma en producción
CORS_ORIGIN=*
```

> [!IMPORTANT]
> El esquema Zod en `backend/src/config/environment.js` abortará la ejecución del servidor al iniciar si falta alguna variable obligatoria o si `JWT_SECRET` no cumple con la longitud mínima de 32 caracteres.

---

## 12. Ejecución del Proyecto

### Iniciar Backend en Modo Desarrollo (Nodemon)

```bash
cd backend
npm run dev
```

El servidor estará escuchando en `http://localhost:3000`.

### Iniciar Frontend (Servidor Estático)

Desde la raíz del proyecto o dentro del directorio `frontend/`:

```bash
npx serve frontend -p 8080
```

Acceda desde su navegador a: `http://localhost:8080`

### Acceso a la Documentación Interactiva de la API

Con el backend en ejecución, abra la siguiente URL en su navegador para explorar e probar todos los endpoints mediante **Swagger UI**:

```text
http://localhost:3000/api-docs
```

---

## 13. Base de Datos

El sistema utiliza **PostgreSQL** mediante el driver nativo `pg` utilizando un **Pool de Conexiones** optimizado para aplicaciones asíncronas.

### Características Principales

- **Integridad Referencial:** Claves primarias UUID/Serial e integridades foráneas (`FOREIGN KEY`) con políticas en cascada configuradas.
- **Normalización Relacional:** Esquema diseñado hasta la Tercera Forma Normal (3FN).
- **Manejo de Transacciones:** Garantía ACID en operaciones complejas de registro de usuario y vinculación comercial.
- **Entidades Clave:**
  - `users` (Usuarios y credenciales)
  - `roles` (Roles de sistema)
  - `companies` (Información de empresas)
  - `suppliers` (Proveedores y certificación)
  - `products` (Catálogo de bienes y servicios)
  - `categories` (Categorización de productos)
  - `comments` (Reseñas y calificaciones)
  - `favorites` (Marcadores de usuarios)

---

## 14. API REST & Documentación Swagger

La API de ProveeLink cumple con los principios de diseño de **RESTful Web APIs**.

### Estándar de Respuestas JSON

Todas las respuestas emitidas por la API siguen una estructura JSON consistente:

#### Respuesta Exitosa (`200 OK`, `201 Created`):
```json
{
  "success": true,
  "message": "Operación realizada con éxito",
  "data": { ... }
}
```

#### Respuesta de Error (`400`, `401`, `403`, `404`, `500`):
```json
{
  "success": false,
  "message": "Descripción comprensible del error",
  "errors": { ... }
}
```

### Autenticación en Endpoints

Los endpoints protegidos requieren la inclusión del encabezado HTTP estándar `Authorization`:

```http
Authorization: Bearer <tu_token_jwt>
```

### Especificación OpenAPI 3.0 (Swagger)

El proyecto incluye documentación técnica viva generada automáticamente mediante `@swagger-jsdoc`. Puede consultar el archivo JSON OpenAPI en: `http://localhost:3000/api-docs.json`.

---

## 15. Almacenamiento de Imágenes

Para garantizar el rendimiento óptimo del motor de base de datos relacional y reducir la carga de transferencia I/O en PostgreSQL, los recursos multimedia no se almacenan como datos binarios (`BLOB`).

1. **Subida Directa / Gestor:** Los logotipos corporativos, fotos de productos y avatares de perfil se cargan a través del cliente **Supabase Storage** (`js/services/supabase.js`).
2. **Referencia Persistida:** Se almacena únicamente la **URL pública HTTPS** del activo resultante en la columna correspondiente de PostgreSQL.

---

## 16. Estructura de Codificación

El código fuente del proyecto se rige por los principios de desarrollo de software **SOLID**, **DRY (Don't Repeat Yourself)** y **Clean Code**:

- **Principio de Responsabilidad Única:** Cada archivo y clase posee un único cometido dentro del sistema.
- **Manejo Centralizado de Errores:** Errores controlados de la aplicación se gestionan mediante la clase `AppError` e interceptados por el middleware `errorHandler.js`.
- **Validación Estricta:** Las solicitudes entrantes (`req.body`, `req.params`, `req.query`) se validan con Zod schemas antes de ser procesadas por los servicios.
- **Logging Estructurado:** Uso de `pino` logger para el registro de eventos en formato JSON procesable en entornos de producción.

---

## 17. Convenciones de Desarrollo

- **Variables y Funciones:** `camelCase` (ej. `getUserById`, `authService`).
- **Clases y Modelos:** `PascalCase` (ej. `AppError`).
- **Nombres de Archivos Frontend:** `kebab-case` para HTML y CSS (ej. `category-info.css`).
- **Nombres de Archivos Backend:** `camelCase` o notación con punto (ej. `auth.controller.js`, `userRoutes.js`).
- **Base de Datos:** `snake_case` para nombres de tablas y columnas (ej. `user_id`, `created_at`).
- **Módulos:** Módulos de JavaScript nativos (`import` / `export`).

---

## 18. Seguridad

ProveeLink incorpora múltiples capas de protección técnica:

- **Autenticación Fuerte:** Tokens JWT firmados con algoritmo HS256 y expiración configurable.
- **Protección de Contraseñas:** Hashing de claves con `bcrypt` aplicando un factor de costo (*salt rounds*) adecuado.
- **Prevención de Inyección SQL:** Todas las interacciones con PostgreSQL emplean consultas preparadas parametrizadas (`pg`).
- **Validación y Sanitización:** Zod descarta propiedades no declaradas en las peticiones entrantes.
- **CORS Configurable:** Restricción estricta de orígenes permitidos configurables vía entorno.
- **Gestión de Errores Segura:** Los detalles técnicos de pila de ejecución (*stack traces*) no se exponen al usuario final en entorno de producción.

---

## 19. Manual de Despliegue

### Despliegue del Backend

1. **Aprovisionamiento:** Instale Node.js v20+ y PostgreSQL v16+ en el servidor de destino (ej. VPS Linux Ubuntu).
2. **Repositorio:** Clone el código fuente en `/var/www/proveelink-backend`.
3. **Variables de Entorno:** Configure el archivo `.env` garantizando que `NODE_ENV=production` y `CORS_ORIGIN` apunte al dominio del frontend.
4. **Base de Datos:** Ejecute los scripts de la carpeta `database/` para generar las tablas e índices.
5. **Gestor de Procesos:** Utilice `PM2` para mantener la ejecución en segundo plano y restart automático:
   ```bash
   npm install -g pm2
   pm2 start src/server.js --name "proveelink-api"
   pm2 save
   ```

### Despliegue del Frontend (PWA)

1. Transfiera el contenido de la carpeta `frontend/` al servidor de contenido estático (ej. Nginx, Apache o Vercel/Netlify).
2. Actualice las constantes de URL base de la API en `js/services/api.js` para apuntar al dominio público del backend.
3. Asegúrese de servir la aplicación bajo un certificado **HTTPS** válido, requisito indispensable para el correcto funcionamiento del **Service Worker** (`sw.js`) y las capacidades PWA.

---

## 20. Mantenimiento

- **Respaldos de Base de Datos:** Programar volcados periódicos mediante `pg_dump` para salvaguardar la información comercial.
- **Auditoría de Dependencias:** Ejecutar `npm audit` mensualmente en el directorio `backend` para corregir posibles vulnerabilidades en librerías de terceros.
- **Supervisión de Almacenamiento:** Monitorear las cuotas de uso de Supabase Storage.
- **Análisis de Registros:** Inspeccionar los logs de Pino en búsqueda de errores de nivel `error` o `fatal`.

---

## 21. Contribución

Para colaborar en el desarrollo de ProveeLink:

1. Realice un Fork del repositorio.
2. Cree una rama para su funcionalidad o corrección (`git checkout -b feature/nueva-funcionalidad`).
3. Asegúrese de cumplir con la arquitectura multicapa y las convenciones de codificación establecidas.
4. Realice commit de sus cambios (`git commit -m 'feat: agrega nuevo filtro de proveedores'`).
5. Envíe sus cambios a su repositorio (`git push origin feature/nueva-funcionalidad`).
6. Abra un **Pull Request** detallado hacia la rama principal para revisión del equipo.

---

## 22. Créditos

Este proyecto es desarrollado y mantenido por el equipo de
**ProveeLink**:

- **Desarrollo Backend:** Arquitectura de API REST, seguridad JWT, desarrollo del motor PostgreSQL, esquemas Zod e integración con Supabase Storage.
- **Desarrollo Frontend:** Implementación de la PWA, interfaz de usuario responsive, Service Workers e integración cliente de la API.
- **Diseño UX/UI:** Sistemas de diseño, prototipado de interfaces y experiencia de navegación centrada en el usuario.
- **Estrategia y Negocios:** Análisis del mercado MIPYME, validación del catálogo nacional de proveedores y propuesta de valor.

---

<div align="center">
  <sub>ProveeLink © 2026. Todos los derechos reservados.</sub>
</div>
