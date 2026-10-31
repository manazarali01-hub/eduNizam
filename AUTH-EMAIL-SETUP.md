# EduNizam Auth Email / OTP Setup

EduNizam login supports:
- Email verification after first signup
- 6-digit email OTP verification when the Supabase email template includes `{{ .Token }}`
- Forgot Password recovery email
- 6-digit recovery OTP with `type: 'recovery'`
- Secure reset-link fallback
- New password update after recovery

## Recommended SMTP provider for the pilot

Brevo free SMTP can be used for transactional authentication email.

GitHub repository secrets required by `.github/workflows/configure-auth-email.yml` (Brevo host `smtp-relay.brevo.com` and port `587` are already configured):

- `SUPABASE_ACCESS_TOKEN` — Supabase personal access token (existing deployment secret)
- `EDUNIZAM_SMTP_USER` — Brevo SMTP login shown on Brevo's SMTP page
- `EDUNIZAM_SMTP_PASS` — Brevo SMTP key (not API key)
- `EDUNIZAM_SMTP_FROM_EMAIL` — a verified sender email in Brevo

Do not put SMTP passwords or Supabase personal access tokens in source files.

After the secrets are present, manually run the GitHub Actions workflow **Configure EduNizam Auth Email** once. It configures Supabase SMTP, enforces email confirmation, and applies OTP-enabled signup and recovery email templates.

## Test

1. Create a test account with a new email.
2. Confirm the received email contains a 6-digit code.
3. Enter the code in EduNizam and confirm the account opens only after verification.
4. Sign out and use **Forgot password?**
5. Confirm a recovery email contains a 6-digit code.
6. Enter it in EduNizam, set a new password, then log in with the new password.
