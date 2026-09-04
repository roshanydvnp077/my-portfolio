-- Admin-only Family Details migration.
-- Run this in the Supabase SQL Editor after the existing schema.
-- This migration is additive and does not alter existing public tables.

create table if not exists public.family_details (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  relation text,
  date_of_birth date,
  phone text,
  email text,
  address text,
  occupation text,
  notes text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete cascade
);

create index if not exists family_details_created_by_idx on public.family_details (created_by);
create index if not exists family_details_relation_idx on public.family_details (relation);

-- Normalize the existing admin check used by the Admin Panel and RLS policies.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
      and role = 'admin'
  );
$$;

alter table public.family_details enable row level security;

drop policy if exists family_details_admin_select on public.family_details;
drop policy if exists family_details_admin_insert on public.family_details;
drop policy if exists family_details_admin_update on public.family_details;
drop policy if exists family_details_admin_delete on public.family_details;

create policy family_details_admin_select
on public.family_details for select to authenticated
using (public.is_admin());

create policy family_details_admin_insert
on public.family_details for insert to authenticated
with check (public.is_admin() and created_by = auth.uid());

create policy family_details_admin_update
on public.family_details for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy family_details_admin_delete
on public.family_details for delete to authenticated
using (public.is_admin());

-- Reuse the existing timestamp trigger function from supabase-schema.sql.
drop trigger if exists family_details_updated_at on public.family_details;
create trigger family_details_updated_at
before update on public.family_details
for each row execute procedure public.set_updated_at();

insert into storage.buckets (id, name, public)
values ('family-private', 'family-private', false)
on conflict (id) do update set public = false;

drop policy if exists family_private_admin_select on storage.objects;
drop policy if exists family_private_admin_insert on storage.objects;
drop policy if exists family_private_admin_update on storage.objects;
drop policy if exists family_private_admin_delete on storage.objects;

create policy family_private_admin_select
on storage.objects for select to authenticated
using (
  bucket_id = 'family-private'
  and public.is_admin()
);

create policy family_private_admin_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'family-private'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_admin()
);

create policy family_private_admin_update
on storage.objects for update to authenticated
using (bucket_id = 'family-private' and public.is_admin())
with check (bucket_id = 'family-private' and public.is_admin());

create policy family_private_admin_delete
on storage.objects for delete to authenticated
using (bucket_id = 'family-private' and public.is_admin());

notify pgrst, 'reload schema';
