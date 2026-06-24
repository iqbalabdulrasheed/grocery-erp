-- Grocery Warehouse ERP System - PostgreSQL/Supabase Database Schema
-- Paste this script into your Supabase SQL Editor to initialize all tables.

-- Disable RLS by default for simple demonstration, or enable with policies below.

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'superowner', 'owner', 'manager', 'staff', 'delivery', 'customer', 'accountant')),
    credit_limit NUMERIC(12, 2) DEFAULT 0,
    outstanding_balance NUMERIC(12, 2) DEFAULT 0,
    opening_balance NUMERIC(12, 2) DEFAULT 0,
    customer_discount NUMERIC(5, 2) DEFAULT 0,
    custom_pricing JSONB DEFAULT '{}'::jsonb,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- 2. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'Pcs',
    purchase_cost NUMERIC(12, 2) NOT NULL,
    selling_price NUMERIC(12, 2) NOT NULL,
    min_stock INTEGER NOT NULL DEFAULT 5,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- 3. WAREHOUSES TABLE
CREATE TABLE IF NOT EXISTS public.warehouses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- 4. WAREHOUSE STOCK TABLE
CREATE TABLE IF NOT EXISTS public.warehouse_stock (
    id TEXT PRIMARY KEY,
    warehouse_id TEXT REFERENCES public.warehouses(id) ON DELETE CASCADE,
    warehouse_name TEXT NOT NULL,
    product_id TEXT REFERENCES public.products(id) ON DELETE CASCADE,
    qty INTEGER NOT NULL DEFAULT 0,
    UNIQUE(warehouse_id, product_id)
);

-- 5. STOCK LEDGER TABLE
CREATE TABLE IF NOT EXISTS public.stock_ledger (
    id TEXT PRIMARY KEY,
    product_id TEXT REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    qty_change INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('purchase', 'supplier_return', 'customer_return', 'manual_adjustment', 'customer_sales', 'damage', 'expired', 'dispatch', 'transfer_in', 'transfer_out')),
    notes TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    user_id TEXT,
    user_name TEXT,
    warehouse_id TEXT REFERENCES public.warehouses(id) ON DELETE SET NULL,
    warehouse_name TEXT
);

-- 6. ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    created_by_id TEXT NOT NULL,
    created_by_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    type TEXT NOT NULL CHECK (type IN ('normal', 'walk-in', 'phone', 'cash')),
    status TEXT NOT NULL CHECK (status IN ('created', 'approved', 'packing', 'assigned', 'out_for_delivery', 'delivered', 'failed')),
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    subtotal NUMERIC(12, 2) NOT NULL,
    discount NUMERIC(12, 2) DEFAULT 0,
    manual_discount_pct NUMERIC(5, 2) DEFAULT 0,
    manual_discount_amt NUMERIC(12, 2) DEFAULT 0,
    total NUMERIC(12, 2) NOT NULL,
    assigned_staff_id TEXT DEFAULT NULL,
    assigned_staff_name TEXT DEFAULT NULL,
    delivery_route TEXT DEFAULT NULL,
    warehouse_id TEXT DEFAULT NULL,
    warehouse_name TEXT DEFAULT NULL,
    cod_tracking BOOLEAN DEFAULT FALSE,
    cod_collected BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    status_history JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- 7. STOCK RESERVATION TABLE
CREATE TABLE IF NOT EXISTS public.stock_reservation (
    id TEXT PRIMARY KEY,
    order_id TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES public.products(id) ON DELETE CASCADE,
    warehouse_id TEXT REFERENCES public.warehouses(id) ON DELETE CASCADE,
    qty INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. PICK LISTS TABLE
CREATE TABLE IF NOT EXISTS public.pick_lists (
    id TEXT PRIMARY KEY,
    order_id TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL CHECK (status IN ('pending', 'picking', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. DISPATCHES TABLE
CREATE TABLE IF NOT EXISTS public.dispatches (
    id TEXT PRIMARY KEY,
    order_id TEXT REFERENCES public.orders(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('dispatched', 'delivered', 'failed')),
    dispatched_at TIMESTAMPTZ DEFAULT NOW(),
    delivered_at TIMESTAMPTZ DEFAULT NULL,
    dispatched_by_id TEXT,
    dispatched_by_name TEXT,
    carrier_details TEXT,
    notes TEXT
);

-- 10. CUSTOMER LEDGER TABLE
CREATE TABLE IF NOT EXISTS public.customer_ledger (
    id TEXT PRIMARY KEY,
    customer_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('opening', 'purchase', 'payment')),
    ref_id TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    balance_after NUMERIC(12, 2) NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

-- 11. EXPENSES TABLE
CREATE TABLE IF NOT EXISTS public.expenses (
    id TEXT PRIMARY KEY,
    amount NUMERIC(12, 2) NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- 12. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_role TEXT NOT NULL,
    action TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    details TEXT,
    is_admin_only BOOLEAN DEFAULT FALSE
);

-- 13. USER SESSIONS TABLE (for session sync)
CREATE TABLE IF NOT EXISTS public.user_sessions (
    user_id TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    user_data JSONB NOT NULL,
    last_seen TIMESTAMPTZ DEFAULT NOW()
);

-- SEED INITIAL ADMINISTRATOR ACCOUNT (sysadmin / cfi@2024)
INSERT INTO public.users (id, username, password, name, role)
VALUES ('usr-admin', 'sysadmin', 'cfi@2024', 'System Admin (CFI)', 'admin')
ON CONFLICT (username) DO NOTHING;

-- SEED INITIAL WAREHOUSE
INSERT INTO public.warehouses (id, name, location, is_active)
VALUES ('wh-main', 'Main Warehouse', 'Central Facility', TRUE)
ON CONFLICT (id) DO NOTHING;
