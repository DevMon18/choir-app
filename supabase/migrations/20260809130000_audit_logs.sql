-- Migration: 20260809130000_audit_logs.sql
-- Description: Creates the audit_logs table for administrative audit tracking with RLS policies.

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance index on actor_id and action timestamp
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Read policy: only super_admin, director, and secretary can view audit logs
CREATE POLICY "privileged_view_audit_logs" ON public.audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles a
      WHERE a.id = auth.uid() AND a.role IN ('super_admin', 'director', 'secretary')
    )
  );

-- Insert policy: authenticated users / server actions can insert audit log entries
CREATE POLICY "authenticated_insert_audit_logs" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
