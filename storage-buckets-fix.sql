-- Ensure every storage bucket used by the public and admin clients exists.
-- Run once in the Supabase SQL Editor with database-owner permissions.

insert into storage.buckets (id, name, public)
values
  ('portfolio-images', 'portfolio-images', true),
  ('portfolio-gallery', 'portfolio-gallery', false),
  ('portfolio-documents', 'portfolio-documents', false),
  ('bank-qr', 'bank-qr', false),
  ('family-vault', 'family-vault', false),
  ('family-private', 'family-private', false)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public;

notify pgrst, 'reload schema';
