CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. TABLA: roles
-- ==========================================
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 2. TABLA: users
-- ==========================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    profile_picture_url VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Restricciones (Constraints)
    CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT,
    CONSTRAINT chk_users_status CHECK (status IN ('active', 'inactive', 'suspended'))
);

-- Índices para optimizar las búsquedas frecuentes en usuarios
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role_id);

-- ==========================================
-- 3. TABLA: companies
-- ==========================================
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    tax_id VARCHAR(50) NOT NULL UNIQUE, -- Equivalente a tu campo RUC
    phone VARCHAR(20),
    email VARCHAR(150),
    address TEXT,
    state_province VARCHAR(100),       -- Equivalente a tu campo Departamento
    city VARCHAR(100),                 -- Equivalente a tu campo Municipio
    logo_url VARCHAR(255),
    website_url VARCHAR(255),
    verification_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Restricciones (Constraints)
    CONSTRAINT fk_companies_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT chk_companies_verification CHECK (verification_status IN ('pending', 'verified', 'rejected'))
);

-- Índices para optimizar búsquedas y relaciones de empresas
CREATE INDEX idx_companies_user ON companies(user_id);
CREATE INDEX idx_companies_tax_id ON companies(tax_id);


-- ==========================================
-- 4. TABLA: categories
-- ==========================================
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NULL, -- Relación autorreferencial para subcategorías
    name VARCHAR(100) NOT NULL,
    icon_url VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Restricciones (Constraints)
    CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
    CONSTRAINT chk_categories_status CHECK (status IN ('active', 'inactive')),
    -- Evita que una categoría se repita bajo el mismo padre
    CONSTRAINT uq_categories_name_parent UNIQUE (name, parent_id)
);

-- Índices para optimizar búsquedas jerárquicas
CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_status ON categories(status);

-- ==========================================
-- 5. TABLA: suppliers
-- ==========================================
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL UNIQUE, -- Relación 1:1 o extensión exclusiva de la empresa
    supplier_type VARCHAR(50) NOT NULL, -- Ej: 'manufacturer', 'distributor', 'wholesaler'
    service_description TEXT,
    geographic_coverage VARCHAR(100) NOT NULL DEFAULT 'local', -- Ej: 'local', 'regional', 'national'
    operating_hours VARCHAR(150), -- Ej: 'Mon-Fri 08:00-17:00'
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    average_rating NUMERIC(3,2) NOT NULL DEFAULT 0.00, -- Escala de 0.00 a 5.00
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Restricciones (Constraints)
    CONSTRAINT fk_suppliers_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT chk_suppliers_status CHECK (status IN ('active', 'inactive', 'suspended')),
    CONSTRAINT chk_suppliers_rating CHECK (average_rating BETWEEN 0.00 AND 5.00),
    CONSTRAINT chk_suppliers_geo_coverage CHECK (geographic_coverage IN ('local', 'regional', 'national'))
);

-- Índices para optimizar filtros de búsqueda en la PWA
CREATE INDEX idx_suppliers_company ON suppliers(company_id);
CREATE INDEX idx_suppliers_type ON suppliers(supplier_type);
CREATE INDEX idx_suppliers_rating ON suppliers(average_rating DESC);


-- ==========================================
-- 6. TABLA: products
-- ==========================================
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL,
    category_id UUID NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    price NUMERIC(12,2) NOT NULL DEFAULT 0.00, -- Evita pérdida de precisión decimal
    currency VARCHAR(3) NOT NULL DEFAULT 'USD', -- Código ISO (USD, EUR, HNL, etc.)
    stock NUMERIC(10,2) NOT NULL DEFAULT 0.00, -- NUMERIC permite fracciones (ej: 10.5 kg)
    unit_of_measure VARCHAR(20) NOT NULL,      -- Ej: 'kilograms', 'liters', 'units', 'boxes'
    brand VARCHAR(100),
    model VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Restricciones (Constraints)
    CONSTRAINT fk_products_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
    CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
    CONSTRAINT chk_products_price CHECK (price >= 0.00),
    CONSTRAINT chk_products_stock CHECK (stock >= 0.00),
    CONSTRAINT chk_products_status CHECK (status IN ('active', 'inactive', 'out_of_stock'))
);

-- Índices cruciales para los filtros de búsqueda rápidos en la PWA
CREATE INDEX idx_products_supplier ON products(supplier_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_price ON products(price);

-- ==========================================
-- 7. TABLA: product_images
-- ==========================================
CREATE TABLE product_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Restricciones (Constraints)
    CONSTRAINT fk_images_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Índice para cargar la galería de un producto velozmente
CREATE INDEX idx_product_images_product ON product_images(product_id);

-- ==========================================
-- 8. TABLA: tags
-- ==========================================
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE, -- Las etiquetas no deben duplicarse
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexar el nombre ya que se usará para búsquedas de autocompletado en el frontend
CREATE INDEX idx_tags_name ON tags(name);

-- ==========================================
-- 9. TABLA INTERMEDIA: product_tags (Relación Muchos a Muchos)
-- ==========================================
CREATE TABLE product_tags (
    product_id UUID NOT NULL,
    tag_id UUID NOT NULL,

    -- Llave primaria compuesta: evita que un producto tenga la misma etiqueta dos veces
    PRIMARY KEY (product_id, tag_id),

    -- Restricciones (Constraints)
    CONSTRAINT fk_product_tags_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT fk_product_tags_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Índices para búsquedas inversas (ej: "Buscar todos los productos con la etiqueta X")
CREATE INDEX idx_product_tags_tag ON product_tags(tag_id);

-- ==========================================
-- 10. TABLA: quote_requests (Solicitudes de Cotización)
-- ==========================================
CREATE TABLE quote_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,          -- El cliente/MIPYME que solicita la cotización
    supplier_id UUID NOT NULL,      -- El proveedor al que va dirigida (Cotización Directa)
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    notes TEXT,                     -- Observaciones o términos especiales de la solicitud
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Restricciones (Constraints)
    CONSTRAINT fk_quotes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_quotes_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
    CONSTRAINT chk_quotes_status CHECK (status IN ('pending', 'sent', 'answered', 'accepted', 'rejected', 'cancelled'))
);

-- Índices esenciales para los tableros/dashboards de la PWA (Historial de cotizaciones)
CREATE INDEX idx_quote_requests_user ON quote_requests(user_id);
CREATE INDEX idx_quote_requests_supplier ON quote_requests(supplier_id);
CREATE INDEX idx_quote_requests_status ON quote_requests(status);

-- ==========================================
-- 11. TABLA: quote_items (Detalle de la Cotización)
-- ==========================================
CREATE TABLE quote_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_request_id UUID NOT NULL,
    product_id UUID NOT NULL,
    quantity NUMERIC(10,2) NOT NULL,       -- NUMERIC para soportar decimales (ej: 15.5 kg)
    estimated_price NUMERIC(12,2) NOT NULL, -- Precio de referencia que espera pagar o el guardado en catálogo

    -- Restricciones (Constraints)
    CONSTRAINT fk_quote_items_request FOREIGN KEY (quote_request_id) REFERENCES quote_requests(id) ON DELETE CASCADE,
    CONSTRAINT fk_quote_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    CONSTRAINT chk_quote_items_quantity CHECK (quantity > 0),
    CONSTRAINT chk_quote_items_price CHECK (estimated_price >= 0.00)
);

-- Índices para optimizar la carga de los productos dentro de una cotización
CREATE INDEX idx_quote_items_request ON quote_items(quote_request_id);


-- ==========================================
-- 12. TABLA: comments (Comentarios)
-- ==========================================
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    supplier_id UUID NULL, -- NULL si el comentario es para un producto
    product_id UUID NULL,  -- NULL si el comentario es directo al proveedor
    content TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'visible',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Restricciones (Constraints)
    CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_comments_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
    CONSTRAINT fk_comments_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT chk_comments_status CHECK (status IN ('visible', 'hidden', 'under_review')),

    -- Integridad: El comentario debe estar amarrado obligatoriamente a algo (Proveedor O Producto)
    CONSTRAINT chk_comment_target CHECK (
        (supplier_id IS NOT NULL AND product_id IS NULL) OR
        (supplier_id IS NULL AND product_id IS NOT NULL)
    )
);

-- Índices para cargar secciones de comentarios a alta velocidad
CREATE INDEX idx_comments_supplier ON comments(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX idx_comments_product ON comments(product_id) WHERE product_id IS NOT NULL;


-- ==========================================
-- 13. TABLA: ratings (Calificaciones)
-- ==========================================
CREATE TABLE ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    supplier_id UUID NULL,
    product_id UUID NULL,
    score SMALLINT NOT NULL, -- SMALLINT es ideal para ahorrar espacio (Ej: 1 a 5 estrellas)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Restricciones (Constraints)
    CONSTRAINT fk_ratings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_ratings_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
    CONSTRAINT fk_ratings_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT chk_ratings_score CHECK (score BETWEEN 1 AND 5),

    -- Integridad: La calificación debe ser para un proveedor o para un producto, no ambos ni ninguno
    CONSTRAINT chk_rating_target CHECK (
        (supplier_id IS NOT NULL AND product_id IS NULL) OR
        (supplier_id IS NULL AND product_id IS NOT NULL)
    ),

    -- Evita que un mismo usuario califique más de una vez al mismo producto o al mismo proveedor
    CONSTRAINT uq_user_product_rating UNIQUE (user_id, product_id),
    CONSTRAINT uq_user_supplier_rating UNIQUE (user_id, supplier_id)
);

-- Índices para operaciones agregadas (Como calcular promedios de estrellas)
CREATE INDEX idx_ratings_supplier ON ratings(supplier_id) WHERE supplier_id IS NOT NULL;
CREATE INDEX idx_ratings_product ON ratings(product_id) WHERE product_id IS NOT NULL;


-- ==========================================
-- 14. TABLA: favorites (Favoritos)
-- ==========================================
CREATE TABLE favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    supplier_id UUID NULL,
    product_id UUID NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Restricciones (Constraints)
    CONSTRAINT fk_favorites_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_favorites_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
    CONSTRAINT fk_favorites_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,

    -- Integridad: Debe guardar un proveedor favorito O un producto favorito
    CONSTRAINT chk_favorite_target CHECK (
        (supplier_id IS NOT NULL AND product_id IS NULL) OR
        (supplier_id IS NULL AND product_id IS NOT NULL)
    ),

    -- Evita duplicados (No puedes agregar el mismo producto/proveedor a favoritos dos veces)
    CONSTRAINT uq_user_product_favorite UNIQUE (user_id, product_id),
    CONSTRAINT uq_user_supplier_favorite UNIQUE (user_id, supplier_id)
);

-- Índices para armar la lista de "Mis Favoritos" del usuario en la PWA
CREATE INDEX idx_favorites_user ON favorites(user_id);


create table verify_email(
id  UUID primary key default gen_random_uuid(),
user_id UUID NULL,
email VARCHAR(150) NOT NULL UNIQUE,
code_otp VARCHAR(250),
verification_type VARCHAR(20) DEFAULT  'registro', -- 'registro', 'recuperación','cambio_correo'
created_on TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
expires_in TIMESTAMP WITH TIME ZONE NOT NULL,
used BOOLEAN DEFAULT FALSE,
failed_attempts INT DEFAULT 0
);
