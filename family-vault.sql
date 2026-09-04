-- Private Admin-only Family Vault migration.
-- Run after the existing Supabase schema. This migration is additive.

create table if not exists public.family_members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  relation text,
  gender text,
  date_of_birth date,
  phone text,
  email text,
  address text,
  occupation text,
  blood_group text,
  notes text,
  profile_photo_path text,
  created_by uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.family_documents (
  id uuid primary key default gen_random_uuid(),
  family_member_id uuid not null references public.family_members(id) on delete cascade,
  document_type text not null,
  document_title text not null,
  document_number text,
  issue_date date,
  expiry_date date,
  file_path text not null,
  mime_type text,
  file_size bigint,
  notes text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists family_members_full_name_idx on public.family_members (full_name);
create index if not exists family_members_relation_idx on public.family_members (relation);
create index if not exists family_documents_member_idx on public.family_documents (family_member_id);
create index if not exists family_documents_type_idx on public.family_documents (document_type);
create index if not exists family_documents_title_idx on public.family_documents (document_title);

-- Keep the deployed Admin check aligned with the existing admin_users schema.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid() and role = 'admin'
  );
$$;

alter table public.family_members enable row level security;
alter table public.family_documents enable row level security;

drop policy if exists family_members_admin_select on public.family_members;
drop policy if exists family_members_admin_insert on public.family_members;
drop policy if exists family_members_admin_update on public.family_members;
drop policy if exists family_members_admin_delete on public.family_members;
drop policy if exists family_documents_admin_select on public.family_documents;
drop policy if exists family_documents_admin_insert on public.family_documents;
drop policy if exists family_documents_admin_update on public.family_documents;
drop policy if exists family_documents_admin_delete on public.family_documents;

create policy family_members_admin_select on public.family_members for select to authenticated using (public.is_admin());
create policy family_members_admin_insert on public.family_members for insert to authenticated with check (public.is_admin() and created_by = auth.uid());
create policy family_members_admin_update on public.family_members for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy family_members_admin_delete on public.family_members for delete to authenticated using (public.is_admin());

create policy family_documents_admin_select on public.family_documents for select to authenticated using (public.is_admin());
create policy family_documents_admin_insert on public.family_documents for insert to authenticated with check (public.is_admin() and uploaded_by = auth.uid());
create policy family_documents_admin_update on public.family_documents for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy family_documents_admin_delete on public.family_documents for delete to authenticated using (public.is_admin());

-- Reuse the existing generic trigger function.
drop trigger if exists family_members_updated_at on public.family_members;
create trigger family_members_updated_at before update on public.family_members for each row execute procedure public.set_updated_at();
drop trigger if exists family_documents_updated_at on public.family_documents;
create trigger family_documents_updated_at before update on public.family_documents for each row execute procedure public.set_updated_at();

insert into storage.buckets (id, name, public)
values ('family-vault', 'family-vault', false)
on conflict (id) do update set public = false;

drop policy if exists family_vault_admin_select on storage.objects;
drop policy if exists family_vault_admin_insert on storage.objects;
drop policy if exists family_vault_admin_update on storage.objects;
drop policy if exists family_vault_admin_delete on storage.objects;

create policy family_vault_admin_select on storage.objects for select to authenticated using (bucket_id = 'family-vault' and public.is_admin());
create policy family_vault_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'family-vault' and public.is_admin() and (storage.foldername(name))[1]::uuid is not null);
create policy family_vault_admin_update on storage.objects for update to authenticated using (bucket_id = 'family-vault' and public.is_admin()) with check (bucket_id = 'family-vault' and public.is_admin());
create policy family_vault_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'family-vault' and public.is_admin());

notify pgrst, 'reload schema';
