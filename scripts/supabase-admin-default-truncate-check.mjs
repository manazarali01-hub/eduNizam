import assert from "node:assert/strict";
import fs from "node:fs";

const manual = fs.readFileSync(
  "supabase/manual/revoke-supabase-admin-default-truncate.sql",
  "utf8",
);
const sql = manual.replace(/--.*$/gm, "");

assert.match(sql, /current_user\s*<>\s*'supabase_admin'/i,
  "Manual remediation must fail closed unless current_user is supabase_admin");
assert.match(sql, /alter\s+default\s+privileges\s+in\s+schema\s+public[\s\S]*revoke\s+truncate\s+on\s+tables\s+from\s+anon\s*,\s*authenticated/i,
  "Revoke only future public-table TRUNCATE grants");
assert.match(sql, /alter\s+default\s+privileges\s+in\s+schema\s+graphql[\s\S]*revoke\s+truncate\s+on\s+tables\s+from\s+anon\s*,\s*authenticated/i,
  "Revoke only future graphql-table TRUNCATE grants");
assert.match(sql, /alter\s+default\s+privileges\s+in\s+schema\s+graphql_public[\s\S]*revoke\s+truncate\s+on\s+tables\s+from\s+anon\s*,\s*authenticated/i,
  "Revoke only future graphql_public-table TRUNCATE grants");
assert.match(sql, /pg_default_acl[\s\S]*a\.privilege_type\s*=\s*'TRUNCATE'/i,
  "Verify that no matching owner defaults remain");
assert.doesNotMatch(sql, /\b(drop|truncate)\s+table\b/i,
  "Remediation must not modify or delete table data");
assert.doesNotMatch(sql, /\b(revoke|grant)\s+(all\s+privileges|select|insert|update|delete)\b/i,
  "Remediation must not change ordinary CRUD grants");
assert.doesNotMatch(sql, /alter\s+table|create\s+policy|drop\s+policy/i,
  "Remediation must not change table structure or RLS policies");
assert.match(manual, /existing object ACLs, RLS[\s\S]*not modified/i,
  "Document the narrowly scoped effect");

console.log("Supabase admin default TRUNCATE remediation contract passed.");
