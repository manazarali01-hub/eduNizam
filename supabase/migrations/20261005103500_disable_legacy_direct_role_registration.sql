-- Enforce the approval-only Teacher / Parent / Student access model.
-- This legacy RPC could otherwise be called directly by an authenticated client
-- to create membership from a school code, bypassing the current Admin approval flow.
REVOKE EXECUTE ON FUNCTION public.register_simple_account_v1(text,text,text,text,text)
FROM PUBLIC, anon, authenticated;
