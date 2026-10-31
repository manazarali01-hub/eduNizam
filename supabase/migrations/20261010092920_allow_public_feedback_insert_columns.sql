-- Applied to the connected Supabase project as migration 20261010092920.
-- The homepage posts feedback as an anonymous visitor through PostgREST.
-- Existing RLS policy enforces allowed category, message length and status='new'.
-- Grant only the three user-submitted fields. Do not grant SELECT, UPDATE, or DELETE.
GRANT INSERT (category, message, rating)
ON TABLE public.platform_feedback
TO anon, authenticated;
