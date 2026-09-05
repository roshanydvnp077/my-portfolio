# Supabase Portfolio Setup

## 1. Configure the frontend

Open `supabase-config.js` and replace only the two placeholders with the Supabase project URL and publishable/anon key:

```js
const SUPABASE_URL = "https://odjzahkfgkpkdoqkgbbg.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "YOUR_SUPABASE_PUBLISHABLE_KEY";
```

Never use a service-role key in this file or anywhere in the GitHub Pages frontend.

## 2. Create the database and policies

1. Open Supabase Dashboard.
2. Select the project.
3. Open **SQL Editor**.
4. Open `supabase-schema.sql` from this repository and run it.
5. The script creates or migrates `admin_users`, `gallery`, `documents`, `contact_messages`, `projects`, `skills`, `services`, `journey`, `profile`, and `site_settings`, enables RLS, and creates Storage policies.

The public contact form can insert messages, but only an authenticated user listed in `admin_users` can read, update, or delete them.

## 3. Create the admin account

1. Open **Authentication > Users**.
2. Create the admin email and password.
3. Copy the new user's UUID.
4. Run this in SQL Editor:

```sql
insert into public.admin_users (user_id)
values ('PASTE_ADMIN_USER_UUID_HERE');
```

5. Disable public signups in **Authentication > Settings** after the admin account exists.

## 4. Storage

The SQL creates these buckets:

- `portfolio-images`: public bucket for intentionally public portfolio gallery images.
- `portfolio-documents`: private bucket for documents.

Upload through the deployed Admin panel. Gallery images are written to `portfolio-images`; documents are written to `portfolio-documents`.

## 5. Admin workflow

1. Open the deployed portfolio.
2. Select **Admin** in the navigation.
3. Sign in with the Supabase Auth admin account.
4. Choose **Gallery** or **Documents**.
5. Add title, description, and file.
6. Use Preview, Edit, or Delete in the admin record list.

Gallery preview uses a public URL only for records marked public. Document preview/download requests a short-lived signed URL from the private bucket.

## 6. GitHub Pages deployment

1. Verify `supabase-config.js` contains only the Supabase project URL and publishable/anon key.
2. Confirm no service-role key, password, private file, or private storage URL is committed.
3. Commit and push:

```bash
git add index.html service-worker.js supabase-config.js supabase-schema.sql SUPABASE_SETUP.md
git commit -m "Integrate Supabase portfolio admin"
git push origin main
```

4. In GitHub, open **Settings > Pages**.
5. Select the `main` branch and `/ (root)`.
6. Deploy and open the published HTTPS URL.

## 7. Security checks

- Open a private document storage URL without signing in. It must fail because `portfolio-documents` is private.
- Sign in as a normal non-admin Supabase user. The `admin_users` check must fail and the Admin panel must not open.
- Sign in as the authorized admin. Preview and Download should work only through a temporary signed URL.
- Sign out and retry the signed URL after it expires. Access must fail.
- Inspect the repository search results for `service_role`, `service-role`, passwords, and private document paths. None should appear.
- Do not upload private documents into GitHub. Upload them only through the Admin panel.

Client-side JavaScript cannot make a static GitHub Pages site a true secret store. Supabase Auth, RLS, and Storage policies are the security boundary; the publishable/anon key is safe to expose only with those policies enabled.

## 8. Password Vault

To enable the admin-only Password Vault, run `password-vault.sql` in the existing Supabase SQL Editor. It creates `public.password_vault` only if missing, enables RLS, and scopes every policy to the authenticated admin's `auth.uid()`. No public policy is created.

## 9. Bank Details

To enable the admin-only Bank Details section, run `bank-details.sql` in the existing Supabase SQL Editor. It creates user-scoped RLS policies for `public.bank_details` and the private `bank-qr` Storage bucket. QR files use `{user_id}/qr/...` paths and short-lived signed URLs; no public Storage policy is created.
