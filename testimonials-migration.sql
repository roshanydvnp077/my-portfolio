-- Additive Testimonials migration. Run this in Supabase SQL Editor.
-- Existing testimonials rows and legacy columns are preserved.

create extension if not exists pgcrypto;

create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  person_name text not null default '',
  name text not null default '',
  position text not null default '',
  photo text,
  message text not null default '',
  rating integer not null default 5 check (rating between 1 and 5),
  sort_order integer not null default 0,
  is_published boolean not null default true,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

alter table public.testimonials add column if not exists full_name text not null default '';
alter table public.testimonials add column if not exists person_name text not null default '';
alter table public.testimonials add column if not exists profile_image text;
alter table public.testimonials add column if not exists role text not null default '';
alter table public.testimonials add column if not exists company text not null default '';
alter table public.testimonials add column if not exists location text not null default '';
alter table public.testimonials add column if not exists review text not null default '';
alter table public.testimonials add column if not exists website_url text;
alter table public.testimonials add column if not exists linkedin_url text;
alter table public.testimonials add column if not exists is_featured boolean not null default false;
alter table public.testimonials add column if not exists display_order integer not null default 0;

update public.testimonials
set full_name = coalesce(nullif(full_name, ''), name),
  person_name = coalesce(nullif(person_name, ''), name, full_name),
    profile_image = coalesce(profile_image, photo),
    role = coalesce(nullif(role, ''), position),
    review = coalesce(nullif(review, ''), message),
    display_order = case when display_order = 0 then sort_order else display_order end
where full_name = '' or review = '' or role = '' or profile_image is null;

create index if not exists testimonials_display_order_idx on public.testimonials (is_published, display_order, created_at desc);

create or replace function public.set_testimonial_updated_at()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists testimonials_updated_at on public.testimonials;
create trigger testimonials_updated_at before update on public.testimonials
for each row execute procedure public.set_testimonial_updated_at();

alter table public.testimonials enable row level security;
drop policy if exists testimonials_public_select on public.testimonials;
create policy testimonials_public_select on public.testimonials for select to anon, authenticated
using (is_published = true or public.is_admin());
drop policy if exists testimonials_admin_insert on public.testimonials;
create policy testimonials_admin_insert on public.testimonials for insert to authenticated
with check (created_by = auth.uid() and public.is_admin());
drop policy if exists testimonials_admin_update on public.testimonials;
create policy testimonials_admin_update on public.testimonials for update to authenticated
using (public.is_admin()) with check (public.is_admin());
drop policy if exists testimonials_admin_delete on public.testimonials;
create policy testimonials_admin_delete on public.testimonials for delete to authenticated
using (public.is_admin());

notify pgrst, 'reload schema';
