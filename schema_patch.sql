-- ============================================================
-- SCHEMA PATCH — Grocery Warehouse ERP
-- Run this in your Supabase SQL Editor to add Company Settings
-- and B2B Customer Profiles tables.
-- ============================================================

-- 1. Create company_settings table for the owner business information
CREATE TABLE IF NOT EXISTS public.company_settings (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    postal_code TEXT,
    country TEXT DEFAULT 'Saudi Arabia',
    phone TEXT,
    email TEXT,
    website TEXT,
    vat_number TEXT,
    cr_number TEXT,
    zakat_number TEXT,
    business_license_number TEXT,
    logo_url TEXT,
    stamp_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create customer_companies table for B2B client company details
CREATE TABLE IF NOT EXISTS public.customer_companies (
    customer_id TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    company_name TEXT,
    contact_person TEXT,
    address TEXT,
    city TEXT,
    country TEXT DEFAULT 'Saudi Arabia',
    postal_code TEXT,
    vat_number TEXT,
    cr_number TEXT,
    phone TEXT,
    email TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default owner company settings
INSERT INTO public.company_settings (
    id, name, address, city, postal_code, country, phone, email, website, vat_number, cr_number, zakat_number, business_license_number
) VALUES (
    'owner-company',
    'Zenvora Grocery Distribution Ltd',
    '4259 King Abdulaziz Road',
    'Riyadh',
    '12211',
    'Saudi Arabia',
    '+966 11 456 7890',
    'finance@zenvora.com',
    'www.zenvora.com',
    '310123456700003',
    '1010987654',
    '3101234567',
    'LIC-2026-8890'
) ON CONFLICT (id) DO NOTHING;
