// Supabase Edge Function template for EduNizam admission payments.
// Keep all provider secrets in Edge Function secrets / environment variables.
// Routes expected by frontend:
// POST /payments/create
// POST /payments/webhook/:provider
//
// NOTE: Provider-specific signing and verification MUST follow the current
// gateway documentation before production deployment.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-provider-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = new URL(req.url);
    const serviceUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseAdmin = createClient(serviceUrl, serviceKey);
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUser = createClient(serviceUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    if (url.pathname.endsWith("/payments/create")) {
      const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
      if (authError || !user) throw new Error("Unauthorized");

      const body = await req.json();
      const { applicationId, method, amount, currency = "PKR" } = body;
      if (!applicationId || !method || !Number.isFinite(Number(amount))) throw new Error("Invalid payment request");

      const { data: app, error: appError } = await supabaseUser
        .from("applications")
        .select("id,application_no,institution_id,applicant_user_id")
        .eq("id", applicationId)
        .single();
      if (appError || !app) throw new Error("Application not found");

      // Insert pending payment before redirecting to provider.
      const { data: payment, error: payError } = await supabaseUser
        .from("payment_records")
        .insert({
          application_id: applicationId,
          method,
          amount: Number(amount),
          currency,
          status: "Pending",
          gateway_provider: method
        })
        .select()
        .single();
      if (payError) throw payError;

      // TODO provider adapter:
      // 1) Build provider request with server-side secret.
      // 2) Add return/cancel URLs.
      // 3) Save provider transaction id.
      // 4) Return hosted checkout/redirect URL.
      //
      // Example response contract:
      // { paymentId, checkoutUrl, providerTransactionId }

      return new Response(JSON.stringify({
        paymentId: payment.id,
        checkoutUrl: null,
        providerTransactionId: null,
        message: "Payment record created. Configure provider adapter to enable live checkout."
      }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    if (url.pathname.includes("/payments/webhook/")) {
      const provider = url.pathname.split("/").pop() || "unknown";
      const raw = await req.text();

      // CRITICAL: verify provider signature BEFORE parsing/updating.
      // const signature = req.headers.get("x-provider-signature");
      // verifyProviderSignature(provider, raw, signature, Deno.env.get("PROVIDER_WEBHOOK_SECRET"));

      const event = JSON.parse(raw || "{}");

      // Map provider event -> your canonical fields only after verification.
      const gatewayTransactionId = event.transaction_id || event.id || null;
      const status = event.status || null;
      if (!gatewayTransactionId || !status) throw new Error("Invalid webhook payload");

      const canonical =
        ["paid", "success", "completed"].includes(String(status).toLowerCase()) ? "Paid" :
        ["failed", "cancelled", "canceled"].includes(String(status).toLowerCase()) ? "Failed" :
        "Pending";

      const { data: payment, error: updateError } = await supabaseAdmin
        .from("payment_records")
        .update({
          status: canonical,
          gateway_transaction_id: gatewayTransactionId,
          verified_at: canonical === "Paid" ? new Date().toISOString() : null
        })
        .eq("gateway_transaction_id", gatewayTransactionId)
        .select()
        .maybeSingle();
      if (updateError) throw updateError;

      if (payment?.id) {
        await supabaseAdmin.from("audit_logs").insert({
          institution_id: event.institution_id,
          user_id: null,
          action: "payment_webhook_" + canonical.toLowerCase(),
          entity_type: "payment",
          entity_id: String(payment.id),
          details: { provider, gatewayTransactionId }
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...cors, "Content-Type": "application/json" }
      });
    }

    return new Response("Not found", { status: 404, headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" }
    });
  }
});
