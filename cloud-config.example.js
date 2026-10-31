// Copy to cloud-config.js after creating a Supabase project.
// The publishable key is designed for browser use, but database/storage security MUST be enforced by RLS.
// NEVER place service_role keys, payment gateway secrets, webhooks secrets or private API keys here.
window.EDUNIZAM_CLOUD_CONFIG = {
  enabled: false,
  provider: "supabase",
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabasePublishableKey: "YOUR_PUBLISHABLE_KEY",
  institutionId: "",
  admissionsStorageBucket: "admission-documents",
  paymentApiBaseUrl: "" // secure Edge Function/Worker endpoint for live gateways
};
