-- Additive Certificate editor fields. Run in Supabase SQL Editor.
alter table public.certificates add column if not exists category text not null default 'Education';
alter table public.certificates add column if not exists file_path text;
alter table public.certificates add column if not exists file_name text;
alter table public.certificates add column if not exists file_type text;
alter table public.certificates add column if not exists file_size bigint;
notify pgrst, 'reload schema';
