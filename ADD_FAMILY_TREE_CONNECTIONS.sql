-- Add the visible family-tree connections for the current core branch.
-- Review the preview SELECT first. This uses IDs from the existing rows and does not create members.

WITH core_members AS (
  SELECT id, full_name, relationship
  FROM public.family_members
  WHERE is_visible = true
    AND lower(coalesce(branch, '')) = 'core'
),
people AS (
  SELECT
    (array_agg(id) FILTER (WHERE lower(full_name) = 'roshan yadav'))[1] AS current_id,
    (array_agg(id) FILTER (WHERE lower(full_name) = 'kamal narayan yadav'))[1] AS father_id,
    (array_agg(id) FILTER (WHERE lower(full_name) = 'jamuna devi yadav'))[1] AS mother_id,
    array_agg(id) FILTER (WHERE lower(coalesce(relationship, '')) IN ('son', 'daughter', 'child') AND lower(full_name) <> 'roshan yadav') AS child_ids
  FROM core_members
)
SELECT * FROM people;

-- Apply only after confirming the preview IDs above are correct.
-- UPDATE public.family_members AS current_member
-- SET father_id = people.father_id,
--     mother_id = people.mother_id
-- FROM people
-- WHERE current_member.id = people.current_id;

-- UPDATE public.family_members AS child
-- SET father_id = people.current_id
-- FROM people
-- WHERE child.id = ANY(coalesce(people.child_ids, ARRAY[]::uuid[]));

-- Verify the resulting relationship IDs.
-- SELECT id, full_name, relationship, father_id, mother_id, spouse_id
-- FROM public.family_members
-- WHERE lower(coalesce(branch, '')) = 'core'
-- ORDER BY full_name;
