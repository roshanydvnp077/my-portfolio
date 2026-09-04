-- Single additive migration for the portfolio admin system.
-- Safe to run repeatedly. It never drops tables or deletes rows.

create extension if not exists pgcrypto;

-- 1. Create missing tables. Existing tables are preserved.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role = 'admin'),
  created_at timestamptz not null default now()
);

create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(), title text not null default '', description text not null default '',
  file_path text not null default '', file_name text not null default '', file_type text not null default '', file_size bigint not null default 1,
  is_public boolean not null default true, category text not null default '', is_featured boolean not null default false,
  is_published boolean not null default true, sort_order integer not null default 0, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), created_by uuid
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(), title text not null default '', description text not null default '',
  file_path text not null default '', file_name text not null default '', file_type text not null default '', file_size bigint not null default 1,
  is_public boolean not null default false, category text not null default '', is_featured boolean not null default false, is_published boolean not null default false, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(), title text not null default '', slug text not null default '',
  short_description text not null default '', full_description text not null default '', category text not null default '', technologies text[] not null default '{}',
  live_url text, github_url text, is_featured boolean not null default false, is_published boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid
);

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(), name text not null default '', category text not null default 'Other', icon text not null default '',
  level integer not null default 0, sort_order integer not null default 0, is_published boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(), title text not null default '', description text not null default '', icon text not null default '',
  features text[] not null default '{}', sort_order integer not null default 0, is_published boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid
);

create table if not exists public.journey (
  id uuid primary key default gen_random_uuid(), title text not null default '', organization text not null default '', type text not null default 'Other',
  start_date date, end_date date, description text not null default '', location text not null default '', sort_order integer not null default 0,
  is_published boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid
);

create table if not exists public.profile (
  id uuid primary key default gen_random_uuid(), name text not null default '', profile_image text, short_bio text not null default '', about_text text not null default '',
  email text not null default '', phone text, location text, resume text, github text, linkedin text, instagram text, facebook text, other_links text,
  is_published boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid
);

create table if not exists public.site_settings (
  id uuid primary key default gen_random_uuid(), website_title text not null default '', logo_url text, favicon_url text, hero_heading text,
  hero_description text, primary_button_text text, secondary_button_text text, contact_email text, contact_phone text, contact_location text,
  contact_availability text, social_links text, meta_title text, meta_description text, og_image_url text, is_published boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(), name text not null default '', email text not null default '', phone text,
  subject text, message text not null default '', status text not null default 'unread', is_starred boolean not null default false,
  created_at timestamptz not null default now(), read_at timestamptz
);

create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(), name text not null default '', position text not null default '',
  photo text, message text not null default '', rating integer not null default 5 check (rating between 1 and 5),
  sort_order integer not null default 0, is_published boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users(id) on delete restrict
);

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(), title text not null default '', description text not null default '', issuer text not null default '',
  issue_date date, credential_id text, credential_url text,
  sort_order integer not null default 0, is_published boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), created_by uuid references auth.users(id) on delete restrict
);

create table if not exists public.section_settings (
  key text primary key, label text not null default '', is_visible boolean not null default true,
  sort_order integer not null default 0, updated_at timestamptz not null default now(), updated_by uuid references auth.users(id) on delete set null
);

-- Repair older deployments that already had section_settings without the current columns.
alter table public.section_settings add column if not exists key text;
alter table public.section_settings add column if not exists is_visible boolean not null default true;

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(), admin_id uuid references auth.users(id) on delete set null,
  action text not null, module text not null, details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_users add column if not exists role text not null default 'admin';
update public.admin_users set role = 'admin' where role is null or role <> 'admin';
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.admin_users'::regclass and conname = 'admin_users_role_admin_check') then
    alter table public.admin_users add constraint admin_users_role_admin_check check (role = 'admin');
  end if;
end $$;
alter table public.profile add column if not exists experience text;
alter table public.profile add column if not exists availability text;
alter table public.projects add column if not exists image_url text;
alter table public.projects add column if not exists gallery text[] not null default '{}';
alter table public.projects add column if not exists completion_date date;
alter table public.projects add column if not exists status text not null default 'completed';
alter table public.projects add column if not exists sort_order integer not null default 0;
alter table public.services add column if not exists price text;
alter table public.site_settings add column if not exists canonical_url text;
alter table public.site_settings add column if not exists keywords text;
alter table public.site_settings add column if not exists author text;
alter table public.site_settings add column if not exists twitter_image_url text;
alter table public.site_settings add column if not exists google_site_verification text;
alter table public.site_settings add column if not exists google_analytics_id text;
alter table public.site_settings add column if not exists maintenance_mode boolean not null default false;
alter table public.site_settings add column if not exists maintenance_message text;
alter table public.site_settings add column if not exists appearance jsonb not null default '{}'::jsonb;
alter table public.site_settings add column if not exists homepage_settings jsonb not null default '{}'::jsonb;
alter table public.site_settings add column if not exists social_settings jsonb not null default '{}'::jsonb;
alter table public.site_settings add column if not exists footer_settings jsonb not null default '{}'::jsonb;
alter table public.site_settings add column if not exists notification_settings jsonb not null default '{}'::jsonb;
alter table public.site_settings add column if not exists contact_form_enabled boolean not null default true;

insert into public.section_settings (key, label, sort_order) values
  ('hero','Hero',0), ('about','About',1), ('skills','Skills',2), ('projects','Projects',3),
  ('services','Services',4), ('journey','Journey',5), ('testimonials','Testimonials',6),
  ('certificates','Certificates',7), ('contact','Contact',8), ('resume','Resume',9), ('hire_me','Hire Me',10)
on conflict (key) do nothing;

-- 2. Add missing columns to legacy tables. Defaults keep existing rows valid.
alter table public.admin_users add column if not exists created_at timestamptz not null default now();
alter table public.admin_users add column if not exists user_id uuid;

alter table public.gallery add column if not exists title text not null default '';
alter table public.gallery add column if not exists id uuid default gen_random_uuid();
alter table public.gallery add column if not exists description text not null default '';
alter table public.gallery add column if not exists file_path text not null default '';
alter table public.gallery add column if not exists file_name text not null default '';
alter table public.gallery add column if not exists file_type text not null default '';
alter table public.gallery add column if not exists file_size bigint not null default 1;
alter table public.gallery add column if not exists is_public boolean not null default true;
alter table public.gallery add column if not exists category text not null default '';
alter table public.gallery add column if not exists is_featured boolean not null default false;
alter table public.gallery add column if not exists is_published boolean not null default true;
alter table public.gallery add column if not exists sort_order integer not null default 0;
alter table public.gallery add column if not exists created_at timestamptz not null default now();
alter table public.gallery add column if not exists updated_at timestamptz not null default now();
alter table public.gallery add column if not exists created_by uuid;

alter table public.documents add column if not exists title text not null default '';
alter table public.documents add column if not exists id uuid default gen_random_uuid();
alter table public.documents add column if not exists description text not null default '';
alter table public.documents add column if not exists file_path text not null default '';
alter table public.documents add column if not exists file_name text not null default '';
alter table public.documents add column if not exists file_type text not null default '';
alter table public.documents add column if not exists file_size bigint not null default 1;
alter table public.documents add column if not exists is_public boolean not null default false;
alter table public.documents add column if not exists category text not null default '';
alter table public.documents add column if not exists is_featured boolean not null default false;
alter table public.documents add column if not exists is_published boolean not null default false;
alter table public.documents add column if not exists sort_order integer not null default 0;
alter table public.documents add column if not exists created_at timestamptz not null default now();
alter table public.documents add column if not exists updated_at timestamptz not null default now();
alter table public.documents add column if not exists created_by uuid;

alter table public.projects add column if not exists title text not null default '';
alter table public.projects add column if not exists id uuid default gen_random_uuid();
alter table public.projects add column if not exists slug text not null default '';
alter table public.projects add column if not exists short_description text not null default '';
alter table public.projects add column if not exists full_description text not null default '';
alter table public.projects add column if not exists category text not null default '';
alter table public.projects add column if not exists technologies text[] not null default '{}';
alter table public.projects add column if not exists live_url text;
alter table public.projects add column if not exists github_url text;
alter table public.projects add column if not exists is_featured boolean not null default false;
alter table public.projects add column if not exists is_published boolean not null default false;
alter table public.projects add column if not exists created_at timestamptz not null default now();
alter table public.projects add column if not exists updated_at timestamptz not null default now();
alter table public.projects add column if not exists created_by uuid;

alter table public.skills add column if not exists name text not null default '';
alter table public.skills add column if not exists id uuid default gen_random_uuid();
alter table public.skills add column if not exists category text not null default 'Other';
alter table public.skills add column if not exists icon text not null default '';
alter table public.skills add column if not exists level integer not null default 0;
alter table public.skills add column if not exists sort_order integer not null default 0;
alter table public.skills add column if not exists is_published boolean not null default true;
alter table public.skills add column if not exists created_at timestamptz not null default now();
alter table public.skills add column if not exists updated_at timestamptz not null default now();
alter table public.skills add column if not exists created_by uuid;

alter table public.services add column if not exists title text not null default '';
alter table public.services add column if not exists id uuid default gen_random_uuid();
alter table public.services add column if not exists description text not null default '';
alter table public.services add column if not exists icon text not null default '';
alter table public.services add column if not exists features text[] not null default '{}';
alter table public.services add column if not exists sort_order integer not null default 0;
alter table public.services add column if not exists is_published boolean not null default true;
alter table public.services add column if not exists created_at timestamptz not null default now();
alter table public.services add column if not exists updated_at timestamptz not null default now();
alter table public.services add column if not exists created_by uuid;

alter table public.journey add column if not exists title text not null default '';
alter table public.journey add column if not exists id uuid default gen_random_uuid();
alter table public.journey add column if not exists organization text not null default '';
alter table public.journey add column if not exists type text not null default 'Other';
alter table public.journey add column if not exists start_date date;
alter table public.journey add column if not exists end_date date;
alter table public.journey add column if not exists description text not null default '';
alter table public.journey add column if not exists location text not null default '';
alter table public.journey add column if not exists sort_order integer not null default 0;
alter table public.journey add column if not exists is_published boolean not null default true;
alter table public.journey add column if not exists created_at timestamptz not null default now();
alter table public.journey add column if not exists updated_at timestamptz not null default now();
alter table public.journey add column if not exists created_by uuid;

alter table public.profile add column if not exists name text not null default '';
alter table public.profile add column if not exists id uuid default gen_random_uuid();
alter table public.profile add column if not exists profile_image text;
alter table public.profile add column if not exists short_bio text not null default '';
alter table public.profile add column if not exists about_text text not null default '';
alter table public.profile add column if not exists email text not null default '';
alter table public.profile add column if not exists phone text;
alter table public.profile add column if not exists location text;
alter table public.profile add column if not exists resume text;
alter table public.profile add column if not exists github text;
alter table public.profile add column if not exists linkedin text;
alter table public.profile add column if not exists instagram text;
alter table public.profile add column if not exists facebook text;
alter table public.profile add column if not exists other_links text;
alter table public.profile add column if not exists is_published boolean not null default true;
alter table public.profile add column if not exists created_at timestamptz not null default now();
alter table public.profile add column if not exists updated_at timestamptz not null default now();
alter table public.profile add column if not exists created_by uuid;

alter table public.site_settings add column if not exists website_title text not null default '';
alter table public.site_settings add column if not exists id uuid default gen_random_uuid();
alter table public.site_settings add column if not exists logo_url text;
alter table public.site_settings add column if not exists favicon_url text;
alter table public.site_settings add column if not exists hero_heading text;
alter table public.site_settings add column if not exists hero_description text;
alter table public.site_settings add column if not exists primary_button_text text;
alter table public.site_settings add column if not exists secondary_button_text text;
alter table public.site_settings add column if not exists contact_email text;
alter table public.site_settings add column if not exists contact_phone text;
alter table public.site_settings add column if not exists contact_location text;
alter table public.site_settings add column if not exists contact_availability text;
alter table public.site_settings add column if not exists social_links text;
alter table public.site_settings add column if not exists meta_title text;
alter table public.site_settings add column if not exists meta_description text;
alter table public.site_settings add column if not exists og_image_url text;
alter table public.site_settings add column if not exists is_published boolean not null default true;
alter table public.site_settings add column if not exists created_at timestamptz not null default now();
alter table public.site_settings add column if not exists updated_at timestamptz not null default now();
alter table public.site_settings add column if not exists created_by uuid;

alter table public.contact_messages add column if not exists name text not null default '';
alter table public.contact_messages add column if not exists id uuid default gen_random_uuid();
alter table public.contact_messages add column if not exists email text not null default '';
alter table public.contact_messages add column if not exists phone text;
alter table public.contact_messages add column if not exists subject text;
alter table public.contact_messages add column if not exists message text not null default '';
alter table public.contact_messages add column if not exists status text not null default 'unread';
alter table public.contact_messages add column if not exists is_starred boolean not null default false;
alter table public.contact_messages add column if not exists created_at timestamptz not null default now();
alter table public.contact_messages add column if not exists read_at timestamptz;
-- The Admin form submits technologies/features as arrays. Convert legacy text columns
-- without losing their comma-separated values or creating duplicate columns.
do $$
begin
  if exists (select 1 from pg_attribute where attrelid = 'public.projects'::regclass and attname = 'technologies' and atttypid in ('text'::regtype, 'varchar'::regtype)) then
    alter table public.projects alter column technologies type text[] using coalesce(array_remove(string_to_array(nullif(trim(technologies), ''), ','), ''), '{}'::text[]);
  end if;
  if exists (select 1 from pg_attribute where attrelid = 'public.services'::regclass and attname = 'features' and atttypid in ('text'::regtype, 'varchar'::regtype)) then
    alter table public.services alter column features type text[] using coalesce(array_remove(string_to_array(nullif(trim(features), ''), ','), ''), '{}'::text[]);
  end if;
end $$;

-- 3. Add foreign keys only when absent. Existing records are preserved; invalid legacy ownership is cleared.
do $$
declare table_name text;
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.admin_users'::regclass and contype = 'f' and conkey @> array[(select attnum from pg_attribute where attrelid = 'public.admin_users'::regclass and attname = 'user_id')]::smallint[]) then
    begin
      alter table public.admin_users add constraint admin_users_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade;
    exception when duplicate_object or foreign_key_violation then
      raise notice 'Skipped admin_users user_id foreign key because legacy data or constraint is incompatible';
    end;
  end if;
  foreach table_name in array array['gallery','documents','projects','skills','services','journey','profile','site_settings'] loop
    if not exists (
      select 1
      from pg_constraint constraint_info
      join pg_attribute column_info on column_info.attrelid = constraint_info.conrelid
        and column_info.attname = 'created_by'
        and column_info.attnum = any(constraint_info.conkey)
      where constraint_info.conrelid = format('public.%I', table_name)::regclass
        and constraint_info.contype = 'f'
    ) then
      -- Preserve legacy records while clearing only ownership IDs that cannot reference auth.users.
      begin
        execute format('update public.%I as legacy set created_by = null where legacy.created_by is not null and not exists (select 1 from auth.users where auth.users.id = legacy.created_by)', table_name);
        execute format('alter table public.%I add constraint %I foreign key (created_by) references auth.users(id) on delete restrict', table_name, table_name || '_created_by_fkey');
      exception when duplicate_object then
        raise notice 'Skipped % created_by foreign key because a legacy constraint already exists', table_name;
      end;
    end if;
  end loop;
end $$;

-- 4. Indexes and updated_at trigger.
create index if not exists projects_slug_idx on public.projects (slug) where slug <> '';
create index if not exists contact_messages_created_at_idx on public.contact_messages (created_at desc);
create index if not exists contact_messages_status_idx on public.contact_messages (status);
create index if not exists gallery_sort_order_idx on public.gallery (sort_order, created_at desc);
create index if not exists projects_published_idx on public.projects (is_published, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['gallery','documents','projects','skills','services','journey','profile','site_settings'] loop
    execute format('drop trigger if exists %I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_updated_at before update on public.%I for each row execute procedure public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

-- 5. RLS. Policies are created only after all referenced columns exist.
alter table public.admin_users enable row level security;
alter table public.gallery enable row level security;
alter table public.documents enable row level security;
alter table public.projects enable row level security;
alter table public.skills enable row level security;
alter table public.services enable row level security;
alter table public.journey enable row level security;
alter table public.profile enable row level security;
alter table public.site_settings enable row level security;
alter table public.contact_messages enable row level security;
alter table public.testimonials enable row level security;
alter table public.certificates enable row level security;
alter table public.section_settings enable row level security;
alter table public.activity_logs enable row level security;

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

do $$
declare table_name text; policy_name text;
begin
  foreach table_name in array array['admin_users','gallery','documents','projects','skills','services','journey','profile','site_settings','contact_messages','testimonials','certificates','section_settings','activity_logs'] loop
    for policy_name in select policyname from pg_policies where schemaname = 'public' and tablename = table_name loop
      execute format('drop policy if exists %I on public.%I', policy_name, table_name);
    end loop;
  end loop;
end $$;

drop policy if exists testimonials_public_select on public.testimonials;
create policy testimonials_public_select on public.testimonials for select to anon, authenticated using (is_published = true or public.is_admin());
drop policy if exists testimonials_admin_insert on public.testimonials;
create policy testimonials_admin_insert on public.testimonials for insert to authenticated with check (created_by = auth.uid() and public.is_admin());
drop policy if exists testimonials_admin_update on public.testimonials;
create policy testimonials_admin_update on public.testimonials for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists testimonials_admin_delete on public.testimonials;
create policy testimonials_admin_delete on public.testimonials for delete to authenticated using (public.is_admin());

drop policy if exists certificates_public_select on public.certificates;
create policy certificates_public_select on public.certificates for select to anon, authenticated using (is_published = true or public.is_admin());
drop policy if exists certificates_admin_insert on public.certificates;
create policy certificates_admin_insert on public.certificates for insert to authenticated with check (created_by = auth.uid() and public.is_admin());
drop policy if exists certificates_admin_update on public.certificates;
create policy certificates_admin_update on public.certificates for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists certificates_admin_delete on public.certificates;
create policy certificates_admin_delete on public.certificates for delete to authenticated using (public.is_admin());

drop policy if exists section_settings_public_select on public.section_settings;
create policy section_settings_public_select on public.section_settings for select to anon, authenticated using (true);
drop policy if exists section_settings_admin_insert on public.section_settings;
create policy section_settings_admin_insert on public.section_settings for insert to authenticated with check (public.is_admin());
drop policy if exists section_settings_admin_update on public.section_settings;
create policy section_settings_admin_update on public.section_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists section_settings_admin_delete on public.section_settings;
create policy section_settings_admin_delete on public.section_settings for delete to authenticated using (public.is_admin());

drop policy if exists activity_logs_admin_select on public.activity_logs;
create policy activity_logs_admin_select on public.activity_logs for select to authenticated using (public.is_admin());
drop policy if exists activity_logs_admin_insert on public.activity_logs;
create policy activity_logs_admin_insert on public.activity_logs for insert to authenticated with check (admin_id = auth.uid() and public.is_admin());

drop policy if exists admin_users_select_self on public.admin_users;
create policy admin_users_select_self on public.admin_users for select to authenticated using (user_id = auth.uid());

drop policy if exists contact_messages_public_insert on public.contact_messages;
create policy contact_messages_public_insert on public.contact_messages for insert to anon, authenticated with check (true);
drop policy if exists contact_messages_admin_select on public.contact_messages;
create policy contact_messages_admin_select on public.contact_messages for select to authenticated using (public.is_admin());
drop policy if exists contact_messages_admin_update on public.contact_messages;
create policy contact_messages_admin_update on public.contact_messages for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists contact_messages_admin_delete on public.contact_messages;
create policy contact_messages_admin_delete on public.contact_messages for delete to authenticated using (public.is_admin());

do $$
declare table_name text;
begin
  foreach table_name in array array['projects','skills','services','journey','profile','site_settings'] loop
    execute format('drop policy if exists %I_public_select on public.%I', table_name, table_name);
    execute format('create policy %I_public_select on public.%I for select to anon, authenticated using (is_published = true or public.is_admin())', table_name, table_name);
    execute format('drop policy if exists %I_admin_insert on public.%I', table_name, table_name);
    execute format('create policy %I_admin_insert on public.%I for insert to authenticated with check (created_by = auth.uid() and public.is_admin())', table_name, table_name);
    execute format('drop policy if exists %I_admin_update on public.%I', table_name, table_name);
    execute format('create policy %I_admin_update on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', table_name, table_name);
    execute format('drop policy if exists %I_admin_delete on public.%I', table_name, table_name);
    execute format('create policy %I_admin_delete on public.%I for delete to authenticated using (public.is_admin())', table_name, table_name);
  end loop;
end $$;

drop policy if exists gallery_public_read on public.gallery;
drop policy if exists gallery_admin_select on public.gallery;
create policy gallery_admin_select on public.gallery for select to authenticated using (public.is_admin());
drop policy if exists gallery_admin_insert on public.gallery;
create policy gallery_admin_insert on public.gallery for insert to authenticated with check (created_by = auth.uid() and public.is_admin());
drop policy if exists gallery_admin_update on public.gallery;
create policy gallery_admin_update on public.gallery for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists gallery_admin_delete on public.gallery;
create policy gallery_admin_delete on public.gallery for delete to authenticated using (public.is_admin());

drop policy if exists documents_public_read on public.documents;
create policy documents_public_read on public.documents for select to authenticated using (public.is_admin());
drop policy if exists documents_admin_insert on public.documents;
create policy documents_admin_insert on public.documents for insert to authenticated with check (created_by = auth.uid() and public.is_admin());
drop policy if exists documents_admin_update on public.documents;
create policy documents_admin_update on public.documents for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists documents_admin_delete on public.documents;
create policy documents_admin_delete on public.documents for delete to authenticated using (public.is_admin());

-- 6. Storage buckets and policies.
insert into storage.buckets (id, name, public) values ('portfolio-images','portfolio-images',true) on conflict (id) do update set public = true;
insert into storage.buckets (id, name, public) values ('portfolio-gallery','portfolio-gallery',false) on conflict (id) do update set public = false;
insert into storage.buckets (id, name, public) values ('portfolio-documents','portfolio-documents',false) on conflict (id) do update set public = false;

drop policy if exists portfolio_images_public_read on storage.objects;
create policy portfolio_images_public_read on storage.objects for select to anon, authenticated using (bucket_id = 'portfolio-images');
drop policy if exists portfolio_documents_admin_read on storage.objects;
create policy portfolio_documents_admin_read on storage.objects for select to authenticated using (bucket_id = 'portfolio-documents' and public.is_admin());
drop policy if exists portfolio_storage_admin_insert on storage.objects;
create policy portfolio_storage_admin_insert on storage.objects for insert to authenticated with check (bucket_id in ('portfolio-images','portfolio-documents') and (storage.foldername(name))[1] = auth.uid()::text and public.is_admin());
drop policy if exists portfolio_storage_admin_update on storage.objects;
create policy portfolio_storage_admin_update on storage.objects for update to authenticated using (bucket_id in ('portfolio-images','portfolio-documents') and public.is_admin()) with check (bucket_id in ('portfolio-images','portfolio-documents') and public.is_admin());
drop policy if exists portfolio_storage_admin_delete on storage.objects;
create policy portfolio_storage_admin_delete on storage.objects for delete to authenticated using (bucket_id in ('portfolio-images','portfolio-documents') and public.is_admin());
drop policy if exists portfolio_gallery_admin_read on storage.objects;
create policy portfolio_gallery_admin_read on storage.objects for select to authenticated using (bucket_id = 'portfolio-gallery' and public.is_admin());
drop policy if exists portfolio_gallery_admin_insert on storage.objects;
create policy portfolio_gallery_admin_insert on storage.objects for insert to authenticated with check (bucket_id = 'portfolio-gallery' and (storage.foldername(name))[1] = auth.uid()::text and public.is_admin());
drop policy if exists portfolio_gallery_admin_update on storage.objects;
create policy portfolio_gallery_admin_update on storage.objects for update to authenticated using (bucket_id = 'portfolio-gallery' and public.is_admin()) with check (bucket_id = 'portfolio-gallery' and public.is_admin());
drop policy if exists portfolio_gallery_admin_delete on storage.objects;
create policy portfolio_gallery_admin_delete on storage.objects for delete to authenticated using (bucket_id = 'portfolio-gallery' and public.is_admin());

-- PostgREST reloads its schema cache after the migration finishes.
alter table public.documents add column if not exists sort_order integer not null default 0;
do $$
declare table_name text;
begin
  foreach table_name in array array['projects','skills','services','journey','profile','site_settings'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
notify pgrst, 'reload schema';
