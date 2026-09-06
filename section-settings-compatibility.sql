-- Safe additive repair for older Supabase deployments.
-- The current public site queries section_settings.key and section_settings.is_visible.
-- This does not drop, rename, or delete existing columns or rows.

alter table public.section_settings add column if not exists key text;
alter table public.section_settings add column if not exists section_key text;
alter table public.section_settings add column if not exists section_label text;
alter table public.section_settings add column if not exists is_visible boolean not null default true;
alter table public.section_settings add column if not exists label text not null default '';
alter table public.section_settings add column if not exists sort_order integer not null default 0;
alter table public.section_settings add column if not exists updated_at timestamptz not null default now();
alter table public.section_settings add column if not exists updated_by uuid;

update public.section_settings
set key = coalesce(key, section_key),
	label = coalesce(nullif(label, ''), section_label, ''),
	section_key = coalesce(section_key, key),
	section_label = coalesce(section_label, label)
where key is null or label = '' or section_key is null or section_label is null;

notify pgrst, 'reload schema';
