-- FAQ admin/content migration
create table if not exists public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null default '',
  answer text not null default '',
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.faqs enable row level security;

drop policy if exists faqs_public_select on public.faqs;
create policy faqs_public_select on public.faqs for select to anon, authenticated using (is_published = true or public.is_admin());
drop policy if exists faqs_admin_insert on public.faqs;
create policy faqs_admin_insert on public.faqs for insert to authenticated with check (created_by = auth.uid() and public.is_admin());
drop policy if exists faqs_admin_update on public.faqs;
create policy faqs_admin_update on public.faqs for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists faqs_admin_delete on public.faqs;
create policy faqs_admin_delete on public.faqs for delete to authenticated using (public.is_admin());

insert into public.faqs (question, answer, sort_order, is_published)
select seed.question, seed.answer, seed.sort_order, true
from (values
  ('Who are you?', 'I am Roshan Kumar Yadav, a full-stack developer and IT student focused on building useful, secure, and polished digital experiences.', 1),
  ('What do you do?', 'I design and develop responsive websites, web applications, dashboards, APIs, and custom digital products for real-world needs.', 2),
  ('What technologies do you use?', 'My main tools include React, JavaScript, Node.js, Laravel, PHP, MySQL, Supabase, Git, and modern HTML/CSS.', 3),
  ('Can I work with you?', 'Yes. I am open to freelance projects, collaborations, and practical product ideas where thoughtful design and reliable development matter.', 4),
  ('How can I contact you?', 'Use the contact form below or email me directly at roshanydvnp077@gmail.com.', 5)
) as seed(question, answer, sort_order)
where not exists (
  select 1 from public.faqs existing where existing.question = seed.question
);
