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
    stock_qty INTEGER NOT NULL DEFAULT 0,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- 3. STOCK LEDGER TABLE
CREATE TABLE IF NOT EXISTS public.stock_ledger (
    id TEXT PRIMARY KEY,
    product_id TEXT REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    qty_change INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('purchase', 'supplier_return', 'manual_adjustment', 'customer_sales', 'damage', 'expired', 'dispatch')),
    notes TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    user_id TEXT,
    user_name TEXT
);

-- 4. ORDERS TABLE
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
    total NUMERIC(12, 2) NOT NULL,
    assigned_staff_id TEXT DEFAULT NULL,
    assigned_staff_name TEXT DEFAULT NULL,
    delivery_route TEXT DEFAULT NULL,
    cod_tracking BOOLEAN DEFAULT FALSE,
    cod_collected BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ DEFAULT NULL,
    status_history JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- 5. CUSTOMER LEDGER TABLE
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

-- 6. EXPENSES TABLE
CREATE TABLE IF NOT EXISTS public.expenses (
    id TEXT PRIMARY KEY,
    amount NUMERIC(12, 2) NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ DEFAULT NULL
);

-- 7. AUDIT LOGS TABLE
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

-- SEED INITIAL ADMINISTRATOR ACCOUNT (sysadmin / cfi@2024)
INSERT INTO public.users (id, username, password, name, role)
VALUES ('usr-admin', 'sysadmin', 'cfi@2024', 'System Admin (CFI)', 'admin')
ON CONFLICT (username) DO NOTHING;
