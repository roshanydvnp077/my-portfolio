-- Safe additive repair for the existing certificates table.
-- Does not alter columns or rows. Run in the Supabase SQL editor.

drop policy if exists certificates_public_select on public.certificates;
drop policy if exists certificates_admin_insert on public.certificates;
drop policy if exists certificates_admin_update on public.certificates;
drop policy if exists certificates_admin_delete on public.certificates;

create policy certificates_public_select
on public.certificates
for select
to anon, authenticated
using (is_published = true or public.is_admin());

create policy certificates_admin_insert
on public.certificates
for insert
to authenticated
with check (created_by = auth.uid() and public.is_admin());

create policy certificates_admin_update
on public.certificates
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy certificates_admin_delete
on public.certificates
for delete
to authenticated
using (public.is_admin());
