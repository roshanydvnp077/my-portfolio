-- Create the admin_users table if it does not already exist.
CREATE TABLE IF NOT EXISTS public.admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Helper used by row-level security policies.
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE au.user_id = auth.uid()
  );
$$;

-- Message inbox table for the portfolio contact form.
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  subject text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'unread' CHECK (status IN ('unread','read')),
  is_starred boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contact_messages_status_idx
  ON public.contact_messages (status);

CREATE INDEX IF NOT EXISTS contact_messages_starred_idx
  ON public.contact_messages (is_starred);

CREATE INDEX IF NOT EXISTS contact_messages_created_at_idx
  ON public.contact_messages (created_at DESC);

-- Make the table readable/writeable through the public API.
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contact_messages_public_insert" ON public.contact_messages;
CREATE POLICY "contact_messages_public_insert"
  ON public.contact_messages
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "contact_messages_admin_select" ON public.contact_messages;
CREATE POLICY "contact_messages_admin_select"
  ON public.contact_messages
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

DROP POLICY IF EXISTS "contact_messages_admin_update" ON public.contact_messages;
CREATE POLICY "contact_messages_admin_update"
  ON public.contact_messages
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "contact_messages_admin_delete" ON public.contact_messages;
CREATE POLICY "contact_messages_admin_delete"
  ON public.contact_messages
  FOR DELETE
  TO authenticated
  USING (public.is_admin_user());

-- Keep admin_users protected as well.
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_users_admin_only_read" ON public.admin_users;
CREATE POLICY "admin_users_admin_only_read"
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (public.is_admin_user());

DROP POLICY IF EXISTS "admin_users_admin_only_manage" ON public.admin_users;
CREATE POLICY "admin_users_admin_only_manage"
  ON public.admin_users
  FOR ALL
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

-- Optional: everyone can see the admin_users table only if they are actually admins.
-- This keeps the admin check strict without exposing other users.
