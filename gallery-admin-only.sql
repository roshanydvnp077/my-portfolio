-- Private Gallery security migration.
-- Existing admin identity: public.admin_users.user_id = auth.uid(), role = 'admin'.
-- This migration preserves public portfolio-images for logos/profile assets and creates
-- a separate private bucket for Gallery objects.

alter table public.gallery enable row level security;

drop policy if exists gallery_public_read on public.gallery;
drop policy if exists gallery_admin_select on public.gallery;
drop policy if exists gallery_admin_insert on public.gallery;
drop policy if exists gallery_admin_update on public.gallery;
drop policy if exists gallery_admin_delete on public.gallery;

create policy gallery_admin_select
on public.gallery for select to authenticated
using (public.is_admin());

create policy gallery_admin_insert
on public.gallery for insert to authenticated
with check (created_by = auth.uid() and public.is_admin());

create policy gallery_admin_update
on public.gallery for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy gallery_admin_delete
on public.gallery for delete to authenticated
using (public.is_admin());

insert into storage.buckets (id, name, public)
values ('portfolio-gallery', 'portfolio-gallery', false)
on conflict (id) do update set public = false;

drop policy if exists portfolio_gallery_admin_read on storage.objects;
drop policy if exists portfolio_gallery_admin_insert on storage.objects;
drop policy if exists portfolio_gallery_admin_update on storage.objects;
drop policy if exists portfolio_gallery_admin_delete on storage.objects;

create policy portfolio_gallery_admin_read
on storage.objects for select to authenticated
using (
  bucket_id = 'portfolio-gallery'
  and public.is_admin()
);

create policy portfolio_gallery_admin_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'portfolio-gallery'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.is_admin()
);

create policy portfolio_gallery_admin_update
on storage.objects for update to authenticated
using (bucket_id = 'portfolio-gallery' and public.is_admin())
with check (bucket_id = 'portfolio-gallery' and public.is_admin());

create policy portfolio_gallery_admin_delete
on storage.objects for delete to authenticated
using (bucket_id = 'portfolio-gallery' and public.is_admin());

notify pgrst, 'reload schema';

-- Existing Gallery rows whose file_path points into portfolio-images must be
-- copied by an authenticated Admin into portfolio-gallery, then their rows'
-- file_path values updated and the old public objects removed. SQL cannot copy
-- Storage object bytes. Do not leave old Gallery objects in portfolio-images.
