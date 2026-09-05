-- ============================================================
-- MIGRACIÓN: 001_verification_system.sql
-- Sistema de verificación de proveedores y pagos PayPal
-- ============================================================

-- ─── ENUMs ────────────────────────────────────────────────────────────────────

CREATE TYPE verification_status_enum AS ENUM (
    'draft',
    'pending_payment',
    'payment_confirmed',
    'pending_review',
    'approved',
    'rejected',
    'expired',
    'cancelled'
);

CREATE TYPE evidence_type_enum AS ENUM (
    'photo',
    'document',
    'facade',
    'interior',
    'other'
);

CREATE TYPE subscription_status_enum AS ENUM (
    'pending',
    'active',
    'expired',
    'cancelled',
    'refunded'
);

CREATE TYPE payment_status_enum AS ENUM (
    'pending',
    'completed',
    'failed',
    'refunded',
    'disputed'
);

-- ─── TABLA: subscription_plans ────────────────────────────────────────────────

CREATE TABLE public.subscription_plans (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100)    NOT NULL,
    duration_months SMALLINT        NOT NULL,
    base_price      NUMERIC(10, 2)  NOT NULL,
    discount_pct    NUMERIC(5, 2)   NOT NULL DEFAULT 0,
    final_price     NUMERIC(10, 2)  NOT NULL,
    currency        VARCHAR(3)      NOT NULL DEFAULT 'USD',
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ─── TABLA: verification_requests ─────────────────────────────────────────────

CREATE TABLE public.verification_requests (
    id                  UUID                        PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id         UUID                        NOT NULL
                            REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    status              verification_status_enum    NOT NULL DEFAULT 'draft',
    business_description TEXT,
    business_address    TEXT,
    contact_name        VARCHAR(150),
    contact_phone       VARCHAR(20),
    rejection_reason    TEXT,
    submitted_at        TIMESTAMPTZ,
    reviewed_at         TIMESTAMPTZ,
    approved_at         TIMESTAMPTZ,
    rejected_at         TIMESTAMPTZ,
    reviewed_by         UUID
                            REFERENCES public.users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ                 NOT NULL DEFAULT NOW()
);

-- Índice único parcial: un proveedor solo puede tener UNA solicitud activa
CREATE UNIQUE INDEX uq_verification_requests_active_supplier
    ON public.verification_requests (supplier_id)
    WHERE status NOT IN ('rejected', 'expired', 'cancelled');

-- ─── TABLA: verification_evidence ─────────────────────────────────────────────

CREATE TABLE public.verification_evidence (
    id              UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id      UUID                NOT NULL
                        REFERENCES public.verification_requests(id) ON DELETE CASCADE,
    evidence_type   evidence_type_enum  NOT NULL DEFAULT 'photo',
    file_url        VARCHAR(500)        NOT NULL,
    file_name       VARCHAR(255),
    display_order   SMALLINT            NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

-- ─── TABLA: subscriptions ─────────────────────────────────────────────────────

CREATE TABLE public.subscriptions (
    id          UUID                        PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID                        NOT NULL
                    REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    request_id  UUID                        NOT NULL
                    REFERENCES public.verification_requests(id) ON DELETE RESTRICT,
    plan_id     UUID                        NOT NULL
                    REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
    status      subscription_status_enum    NOT NULL DEFAULT 'pending',
    start_date  DATE,
    end_date    DATE,
    amount      NUMERIC(10, 2)              NOT NULL,
    currency    VARCHAR(3)                  NOT NULL DEFAULT 'USD',
    created_at  TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ                 NOT NULL DEFAULT NOW()
);

-- ─── TABLA: payments ──────────────────────────────────────────────────────────

CREATE TABLE public.payments (
    id                  UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id     UUID                    NOT NULL
                            REFERENCES public.subscriptions(id) ON DELETE RESTRICT,
    supplier_id         UUID                    NOT NULL
                            REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    external_payment_id VARCHAR(255)            UNIQUE,
    amount              NUMERIC(10, 2)          NOT NULL,
    currency            VARCHAR(3)              NOT NULL DEFAULT 'USD',
    status              payment_status_enum     NOT NULL DEFAULT 'pending',
    payment_method      VARCHAR(50),
    gateway_response    JSONB,
    webhook_verified    BOOLEAN                 NOT NULL DEFAULT FALSE,
    paypal_order_id     VARCHAR(255),
    paid_at             TIMESTAMPTZ,
    created_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

-- ─── ÍNDICES ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_verification_requests_status      ON public.verification_requests (status);
CREATE INDEX idx_verification_requests_supplier_id ON public.verification_requests (supplier_id);
CREATE INDEX idx_subscriptions_supplier_id         ON public.subscriptions (supplier_id);
CREATE INDEX idx_subscriptions_status              ON public.subscriptions (status);
CREATE INDEX idx_payments_status                   ON public.payments (status);
CREATE INDEX idx_payments_subscription_id          ON public.payments (subscription_id);
CREATE INDEX idx_payments_external_payment_id      ON public.payments (external_payment_id);

-- ─── SEEDS: Planes de suscripción ─────────────────────────────────────────────

INSERT INTO public.subscription_plans (name, duration_months, base_price, discount_pct, final_price, currency, is_active)
VALUES
    ('Plan Mensual',   1,  3.00,  0.00,  3.00,  'USD', TRUE),
    ('Plan Semestral', 6,  18.00, 10.00, 16.20, 'USD', TRUE),
    ('Plan Anual',     12, 36.00, 20.00, 28.80, 'USD', TRUE);
