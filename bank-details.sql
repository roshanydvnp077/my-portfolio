-- Admin-only Bank Details migration.
-- Additive: preserves existing data and creates the table/bucket only when missing.

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

create table if not exists public.bank_details (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bank_name text not null default '',
  account_holder_name text not null default '',
  account_number text not null default '',
  account_type text not null default 'Other',
  qr_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bank_details add column if not exists user_id uuid;
alter table public.bank_details add column if not exists bank_name text not null default '';
alter table public.bank_details add column if not exists account_holder_name text not null default '';
alter table public.bank_details add column if not exists account_number text not null default '';
alter table public.bank_details add column if not exists account_type text not null default 'Other';
alter table public.bank_details add column if not exists qr_storage_path text;
alter table public.bank_details add column if not exists created_at timestamptz not null default now();
alter table public.bank_details add column if not exists updated_at timestamptz not null default now();

create index if not exists bank_details_user_id_idx on public.bank_details (user_id, updated_at desc);
alter table public.bank_details enable row level security;

drop policy if exists bank_details_admin_select on public.bank_details;
create policy bank_details_admin_select on public.bank_details for select to authenticated
using (user_id = auth.uid() and public.is_admin());
drop policy if exists bank_details_admin_insert on public.bank_details;
create policy bank_details_admin_insert on public.bank_details for insert to authenticated
with check (user_id = auth.uid() and public.is_admin());
drop policy if exists bank_details_admin_update on public.bank_details;
create policy bank_details_admin_update on public.bank_details for update to authenticated
using (user_id = auth.uid() and public.is_admin())
with check (user_id = auth.uid() and public.is_admin());
drop policy if exists bank_details_admin_delete on public.bank_details;
create policy bank_details_admin_delete on public.bank_details for delete to authenticated
using (user_id = auth.uid() and public.is_admin());

insert into storage.buckets (id, name, public)
values ('bank-qr', 'bank-qr', false)
on conflict (id) do update set public = false;

drop policy if exists bank_qr_admin_select on storage.objects;
create policy bank_qr_admin_select on storage.objects for select to authenticated
using (
  bucket_id = 'bank-qr'
  and public.is_admin()
  and (
    coalesce((storage.foldername(name))[1], '') = auth.uid()::text
    or coalesce((storage.foldername(name))[2], '') = auth.uid()::text
  )
);
drop policy if exists bank_qr_admin_insert on storage.objects;
create policy bank_qr_admin_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'bank-qr'
  and public.is_admin()
  and (
    coalesce((storage.foldername(name))[1], '') = auth.uid()::text
    or coalesce((storage.foldername(name))[2], '') = auth.uid()::text
  )
);
drop policy if exists bank_qr_admin_update on storage.objects;
create policy bank_qr_admin_update on storage.objects for update to authenticated
using (
  bucket_id = 'bank-qr'
  and public.is_admin()
  and (
    coalesce((storage.foldername(name))[1], '') = auth.uid()::text
    or coalesce((storage.foldername(name))[2], '') = auth.uid()::text
  )
)
with check (
  bucket_id = 'bank-qr'
  and public.is_admin()
  and (
    coalesce((storage.foldername(name))[1], '') = auth.uid()::text
    or coalesce((storage.foldername(name))[2], '') = auth.uid()::text
  )
);
drop policy if exists bank_qr_admin_delete on storage.objects;
create policy bank_qr_admin_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'bank-qr'
  and public.is_admin()
  and (
    coalesce((storage.foldername(name))[1], '') = auth.uid()::text
    or coalesce((storage.foldername(name))[2], '') = auth.uid()::text
  )
);

create or replace function public.touch_bank_details_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bank_details_updated_at on public.bank_details;
create trigger bank_details_updated_at before update on public.bank_details
for each row execute function public.touch_bank_details_updated_at();

revoke all on public.bank_details from anon;
notify pgrst, 'reload schema';
