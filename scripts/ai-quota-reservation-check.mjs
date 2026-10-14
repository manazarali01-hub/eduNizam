import fs from "node:fs";
import assert from "node:assert/strict";

const root = process.cwd();
const migration = fs.readFileSync(root + "/supabase-ai-usage-migration.sql", "utf8");
const edge = fs.readFileSync(root + "/supabase/functions/ai-assistant/index.ts", "utf8");

assert.match(migration, /create or replace function public\.edunizam_ai_reserve_usage/i, "quota reservation RPC must exist");
assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\(p_user_id::text, 0\)\)/i, "quota reservations must serialize per user");
assert.match(migration, /where user_id = p_user_id\s+and created_at >= v_day_start/i, "quota must count the user's current UTC day");
assert.match(migration, /insert into public\.ai_usage_logs/i, "reservation must count before provider spend");
assert.match(migration, /revoke all on function public\.edunizam_ai_reserve_usage[\s\S]*from public, anon, authenticated/i, "reservation RPC must not be callable by browser roles");
assert.match(migration, /grant execute on function public\.edunizam_ai_reserve_usage[\s\S]*to service_role/i, "only the server service role should reserve quota");

const reserveAt = edge.indexOf('rpc("edunizam_ai_reserve_usage"');
const providerAt = edge.indexOf('fetch("https://api.openai.com/v1/responses"');
const usageUpdateAt = edge.indexOf('.update({', providerAt);
assert.ok(reserveAt >= 0, "Edge Function must call quota reservation RPC");
assert.ok(providerAt > reserveAt, "quota must be reserved before the provider request");
assert.ok(usageUpdateAt > providerAt, "token usage must update the existing reservation, not insert a second quota row");
assert.match(edge, /Deno\.env\.get\("EDUNIZAM_AI_MODEL"\) \|\| "gpt-6-luna"/, "fallback model must use a published API model identifier");
assert.doesNotMatch(edge, /gpt-5\.6-luna/, "do not regress to the malformed model identifier");
assert.match(edge, /AI quota service is temporarily unavailable\./, "quota database failures must be reported as service unavailable");
assert.match(edge, /if \(!reservation\?\.allowed\)/, "rejected quota reservations must stop provider calls");
assert.doesNotMatch(edge, /\.from\("ai_usage_logs"\)\s*\.insert\(/, "Edge Function must not create a second usage row after provider response");

console.log("AI quota reservation checks passed.");

assert.match(edge, /class HttpError extends Error/, "server failures need explicit HTTP status classification");
assert.ok(edge.includes("throw new HttpError(502, `AI provider request failed (${response.status}).`);"), "provider failures must use a gateway error, not a client error");
assert.match(edge, /const status = e instanceof HttpError \? e\.status : 500/, "unexpected exceptions must return HTTP 500");
assert.match(edge, /const safeMessage = e instanceof HttpError \? message : "AI service encountered an internal error\."/,"unexpected internal errors must not leak raw details");
