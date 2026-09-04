-- Safe additive repair for older Supabase deployments.
-- The current public site queries section_settings.key and section_settings.is_visible.
-- This does not drop, rename, or delete existing columns or rows.

alter table public.section_settings add column if not exists key text;
alter table public.section_settings add column if not exists is_visible boolean not null default true;

notify pgrst, 'reload schema';
