-- Migration: Finance Sinking Fund & Solicitations
-- Timestamp: 2026-09-07
-- Description: Creates append-only financial ledgers for Sinking Fund dues periods, Sunday collections,
--              solicitations/fundraising campaigns, and app settings with strict RLS and idempotency keys.

-- 1. App Configuration Table
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id)
);

INSERT INTO public.app_settings (key, value)
VALUES ('finance_settings', '{"default_monthly_dues_centavos": 4000, "currency": "PHP"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 2. Dues Periods Table (Monthly Target)
CREATE TABLE IF NOT EXISTS public.dues_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_label text NOT NULL, -- e.g. "2026-09"
  base_amount_centavos integer NOT NULL DEFAULT 4000,
  carried_balance_centavos integer NOT NULL DEFAULT 0,
  is_exempt boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_dues_periods_member_period UNIQUE (member_id, period_label)
);

-- 3. Append-Only Dues Payment Ledger
CREATE TABLE IF NOT EXISTS public.dues_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dues_period_id uuid NOT NULL REFERENCES public.dues_periods(id) ON DELETE RESTRICT,
  amount_centavos integer NOT NULL CHECK (amount_centavos > 0),
  method text NOT NULL CHECK (method IN ('cash', 'gcash', 'bank_transfer', 'other')),
  reference text,
  recorded_by uuid NOT NULL REFERENCES public.profiles(id),
  paid_at timestamptz NOT NULL DEFAULT now(),
  client_operation_id text UNIQUE, -- Idempotency key for offline syncing
  voided_at timestamptz,
  voided_reason text,
  voided_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_void_reason CHECK (voided_at IS NULL OR (voided_reason IS NOT NULL AND trim(voided_reason) <> ''))
);

-- 4. Solicitations (Fundraising Campaigns)
CREATE TABLE IF NOT EXISTS public.solicitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  target_amount_centavos integer CHECK (target_amount_centavos IS NULL OR target_amount_centavos > 0),
  start_date date NOT NULL,
  end_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Append-Only Solicitation Contributions Ledger
CREATE TABLE IF NOT EXISTS public.solicitations_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitation_id uuid NOT NULL REFERENCES public.solicitations(id) ON DELETE RESTRICT,
  contributor_type text NOT NULL CHECK (contributor_type IN ('member', 'external')),
  member_id uuid REFERENCES public.profiles(id),
  contributor_name text,
  amount_centavos integer NOT NULL CHECK (amount_centavos > 0),
  method text NOT NULL CHECK (method IN ('cash', 'gcash', 'bank_transfer', 'other')),
  reference text,
  recorded_by uuid NOT NULL REFERENCES public.profiles(id),
  contributed_at timestamptz NOT NULL DEFAULT now(),
  client_operation_id text UNIQUE,
  voided_at timestamptz,
  voided_reason text,
  voided_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_contributor_integrity CHECK (
    (contributor_type = 'member' AND member_id IS NOT NULL) OR
    (contributor_type = 'external' AND member_id IS NULL AND contributor_name IS NOT NULL AND trim(contributor_name) <> '')
  ),
  CONSTRAINT check_solicitation_void CHECK (voided_at IS NULL OR (voided_reason IS NOT NULL AND trim(voided_reason) <> ''))
);

-- 6. Indexes for High-Performance Queries
CREATE INDEX IF NOT EXISTS idx_dues_periods_member ON public.dues_periods(member_id, period_label);
CREATE INDEX IF NOT EXISTS idx_dues_payments_period ON public.dues_payments(dues_period_id) WHERE voided_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dues_payments_paid_at ON public.dues_payments(paid_at);
CREATE INDEX IF NOT EXISTS idx_solicitations_contributions_solicitation ON public.solicitations_contributions(solicitation_id) WHERE voided_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_solicitations_contributions_member ON public.solicitations_contributions(member_id) WHERE member_id IS NOT NULL;

-- 7. Row Level Security Policies
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dues_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dues_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.solicitations_contributions ENABLE ROW LEVEL SECURITY;

-- App settings: authenticated view, finance roles modify
CREATE POLICY "authenticated_view_settings" ON public.app_settings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "finance_modify_settings" ON public.app_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'director', 'treasurer'))
);

-- Dues Periods: Members view own; Finance roles manage all
CREATE POLICY "members_view_own_periods" ON public.dues_periods FOR SELECT USING (
  member_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'director', 'treasurer'))
);
CREATE POLICY "finance_manage_periods" ON public.dues_periods FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'director', 'treasurer'))
);

-- Dues Payments: Members view payments for own periods; Finance roles manage
CREATE POLICY "members_view_own_payments" ON public.dues_payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.dues_periods dp WHERE dp.id = dues_period_id AND dp.member_id = auth.uid()) OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'director', 'treasurer'))
);
CREATE POLICY "finance_manage_payments" ON public.dues_payments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'director', 'treasurer'))
);

-- Solicitations: All authenticated view; Finance roles manage
CREATE POLICY "authenticated_view_solicitations" ON public.solicitations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "finance_manage_solicitations" ON public.solicitations FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'director', 'treasurer'))
);

-- Solicitation Contributions: Authenticated view non-voided; Finance roles manage
CREATE POLICY "authenticated_view_contributions" ON public.solicitations_contributions FOR SELECT USING (
  voided_at IS NULL OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'director', 'treasurer'))
);
CREATE POLICY "finance_manage_contributions" ON public.solicitations_contributions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'director', 'treasurer'))
);
