-- Allow authenticated family members to load the relationship graph.
-- The frontend selects only tree-safe columns; private contact fields are not requested.

DROP POLICY IF EXISTS family_members_visible_tree_read ON public.family_members;

CREATE POLICY family_members_visible_tree_read
  ON public.family_members
  FOR SELECT
  TO authenticated
  USING (is_visible = true OR auth.uid() = auth_user_id OR public.is_admin_user());
