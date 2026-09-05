-- Admin-only Password Vault migration.
-- Additive: creates the table only when missing and preserves existing data.

create table if not exists public.password_vault (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  username text,
  password text not null default '',
  website text,
  category text not null default 'Other',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.password_vault add column if not exists user_id uuid;
alter table public.password_vault add column if not exists title text not null default '';
alter table public.password_vault add column if not exists username text;
alter table public.password_vault add column if not exists password text not null default '';
alter table public.password_vault add column if not exists website text;
alter table public.password_vault add column if not exists category text not null default 'Other';
alter table public.password_vault add column if not exists notes text;
alter table public.password_vault add column if not exists created_at timestamptz not null default now();
alter table public.password_vault add column if not exists updated_at timestamptz not null default now();

create index if not exists password_vault_user_id_idx on public.password_vault (user_id, updated_at desc);
alter table public.password_vault enable row level security;

drop policy if exists password_vault_admin_select on public.password_vault;
create policy password_vault_admin_select
on public.password_vault for select to authenticated
using (user_id = auth.uid() and public.is_admin());

drop policy if exists password_vault_admin_insert on public.password_vault;
create policy password_vault_admin_insert
on public.password_vault for insert to authenticated
with check (user_id = auth.uid() and public.is_admin());

drop policy if exists password_vault_admin_update on public.password_vault;
create policy password_vault_admin_update
on public.password_vault for update to authenticated
using (user_id = auth.uid() and public.is_admin())
with check (user_id = auth.uid() and public.is_admin());

drop policy if exists password_vault_admin_delete on public.password_vault;
create policy password_vault_admin_delete
on public.password_vault for delete to authenticated
using (user_id = auth.uid() and public.is_admin());

create or replace function public.touch_password_vault_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists password_vault_updated_at on public.password_vault;
create trigger password_vault_updated_at
before update on public.password_vault
for each row execute function public.touch_password_vault_updated_at();

-- Keep the password table available to the existing authenticated admin session only.
revoke all on public.password_vault from anon;
