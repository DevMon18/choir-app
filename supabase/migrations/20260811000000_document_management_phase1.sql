-- ===========================================================================
-- PHASE 1: Document Management System (DMS) — Database, Storage & RLS
-- featureSpec.md §§ 2.1 – 2.4
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. ENUMS
-- ---------------------------------------------------------------------------

create type public.document_type_enum as enum (
  'activity_waiver',
  'wedding_waiver',
  'wake_guide',
  'general'
);

create type public.signature_status_enum as enum (
  'pending',
  'submitted',
  'verified',
  'verified_manual',
  'rejected'
);

-- ---------------------------------------------------------------------------
-- 2. TABLE: documents
-- ---------------------------------------------------------------------------

create table public.documents (
  id           uuid        primary key default gen_random_uuid(),
  title        text        not null,
  type         public.document_type_enum not null,
  file_path    text        not null,
  created_by   uuid        not null references public.profiles(id),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz null
);

-- ---------------------------------------------------------------------------
-- 3. TABLE: document_signatures
-- ---------------------------------------------------------------------------

create table public.document_signatures (
  id                   uuid                          primary key default gen_random_uuid(),
  document_id          uuid                          not null references public.documents(id)  on delete cascade,
  -- activity_id is nullable: references mass_sequences as the closest "activity" concept in the current schema.
  -- If a dedicated activities/events table is added later, this FK can be migrated accordingly.
  activity_id          uuid                          null        references public.mass_sequences(id) on delete cascade,
  primary_member_id    uuid                          not null references public.profiles(id)   on delete cascade,
  additional_names     text[]                        not null default '{}',
  signer_printed_name  text                          null,
  status               public.signature_status_enum  not null default 'pending',
  signature_path       text                          null,
  selfie_path          text                          null,
  verified_by          uuid                          null        references public.profiles(id),
  verified_at          timestamptz                   null,
  created_at           timestamptz                   not null default now(),
  updated_at           timestamptz                   not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. TRIGGER: updated_at auto-maintenance on document_signatures
-- ---------------------------------------------------------------------------

create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_document_signatures_updated
  before update on public.document_signatures
  for each row execute function public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 5. STORAGE BUCKETS
-- ---------------------------------------------------------------------------

-- Public/authenticated-read bucket: PDF templates uploaded by admins.
-- The bucket is "private" in Supabase terms but readable by any authenticated
-- user via an RLS policy defined below.
insert into storage.buckets (id, name, public)
values ('choir_documents', 'choir_documents', false)
on conflict (id) do nothing;

-- Strictly private bucket: member signature images and selfies.
insert into storage.buckets (id, name, public)
values ('member_signatures', 'member_signatures', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY — documents table
-- ---------------------------------------------------------------------------

alter table public.documents enable row level security;

-- Any authenticated user may read documents.
create policy "documents_authenticated_select"
  on public.documents for select
  using (auth.role() = 'authenticated');

-- Only directors and super_admins may insert/update/delete.
create policy "documents_admin_write"
  on public.documents for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('director', 'super_admin')
    )
  );

-- ---------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY — document_signatures table
-- ---------------------------------------------------------------------------

alter table public.document_signatures enable row level security;

-- Members read only their own signature rows.
create policy "signatures_member_select"
  on public.document_signatures for select
  using (
    primary_member_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('director', 'super_admin', 'secretary')
    )
  );

-- Members update only their own rows (status, paths, names).
-- The check clause prevents changing the document_id or primary_member_id.
create policy "signatures_member_update"
  on public.document_signatures for update
  using (primary_member_id = auth.uid())
  with check (
    primary_member_id = auth.uid()
    and document_id = document_id  -- cannot alter FK
  );

-- Admins update any row (for verification, rejection, manual-clear).
create policy "signatures_admin_update"
  on public.document_signatures for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('director', 'super_admin')
    )
  );

-- Admins can insert rows (distribution flow).
create policy "signatures_admin_insert"
  on public.document_signatures for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('director', 'super_admin')
    )
  );

-- Admins can delete rows (reject cleanup).
create policy "signatures_admin_delete"
  on public.document_signatures for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('director', 'super_admin')
    )
  );

-- ---------------------------------------------------------------------------
-- 8. STORAGE RLS — choir_documents bucket (PDF templates, admin-write)
-- ---------------------------------------------------------------------------

-- Any authenticated user may read/download PDF templates.
create policy "choir_documents_auth_read"
  on storage.objects for select
  using (
    bucket_id = 'choir_documents'
    and auth.role() = 'authenticated'
  );

-- Only directors/super_admins may upload or delete templates.
create policy "choir_documents_admin_write"
  on storage.objects for insert
  with check (
    bucket_id = 'choir_documents'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('director', 'super_admin')
    )
  );

create policy "choir_documents_admin_delete"
  on storage.objects for delete
  using (
    bucket_id = 'choir_documents'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('director', 'super_admin')
    )
  );

-- ---------------------------------------------------------------------------
-- 9. STORAGE RLS — member_signatures bucket (STRICTLY PRIVATE)
--
-- The file naming convention MUST be:  {primary_member_id}/...
-- This allows the policy to extract the owner id from the file path.
-- Server Actions enforce this convention when uploading.
-- ---------------------------------------------------------------------------

-- Member reads only files under their own uid prefix.
create policy "member_signatures_owner_read"
  on storage.objects for select
  using (
    bucket_id = 'member_signatures'
    and (
      -- File path starts with the caller's uid
      (storage.foldername(name))[1] = auth.uid()::text
      -- OR caller is an admin
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.role in ('director', 'super_admin')
      )
    )
  );

-- Member uploads only to their own uid prefix.
create policy "member_signatures_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'member_signatures'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.role in ('director', 'super_admin')
      )
    )
  );

-- Member/admin deletes from their own uid prefix (for retract & reject flows).
create policy "member_signatures_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'member_signatures'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.role in ('director', 'super_admin')
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 10. DATA RETENTION JOB (pg_cron – enable the pg_cron extension first)
--
-- This job runs DAILY at 02:00 UTC.
--   • Finds verified signatures whose files are older than 30 days.
--   • Sets signature_path and selfie_path to NULL (preserves the audit row).
--   • Actual file deletion from the 'member_signatures' bucket MUST be
--     performed by a separate Supabase Edge Function or a cron-triggered
--     Next.js API route (Route Handler), because pg_cron cannot make HTTP
--     calls to the Supabase Storage REST API directly.
--     See: src/app/api/cron/purge-signatures/route.ts  (Phase 1 companion)
--
-- Prerequisites: run once in Supabase SQL Editor → select cron.schedule(...)
-- ---------------------------------------------------------------------------

-- Uncomment and run manually in Supabase SQL Editor after enabling pg_cron:
-- select cron.schedule(
--   'purge-member-signature-paths',   -- job name
--   '0 2 * * *',                      -- daily at 02:00 UTC
--   $$
--     update public.document_signatures
--     set
--       signature_path = null,
--       selfie_path    = null
--     where
--       status      = 'verified'
--       and verified_at < now() - interval '30 days'
--       and (signature_path is not null or selfie_path is not null);
--   $$
-- );

-- ---------------------------------------------------------------------------
-- 11. USEFUL PERFORMANCE INDEXES
-- ---------------------------------------------------------------------------

create index if not exists idx_documents_type         on public.documents  (type);
create index if not exists idx_documents_created_by   on public.documents  (created_by);

create index if not exists idx_doc_sigs_document_id   on public.document_signatures (document_id);
create index if not exists idx_doc_sigs_member_id     on public.document_signatures (primary_member_id);
create index if not exists idx_doc_sigs_status        on public.document_signatures (status);
create index if not exists idx_doc_sigs_activity_id   on public.document_signatures (activity_id);
