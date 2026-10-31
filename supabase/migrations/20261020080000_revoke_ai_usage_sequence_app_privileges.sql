-- The AI usage table uses an identity sequence. Browser roles read their own
-- usage through table RLS; inserts happen inside the SECURITY DEFINER quota
-- reservation function, owned by postgres, and token updates use the service
-- role. Neither anon nor authenticated needs direct sequence privileges.
revoke all on sequence public.ai_usage_logs_id_seq from anon, authenticated;
