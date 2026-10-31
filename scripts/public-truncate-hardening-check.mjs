import fs from "node:fs";
import assert from "node:assert/strict";

const migration = fs.readFileSync(
  "supabase/migrations/20261021100000_revoke_public_truncate_app_roles.sql",
  "utf8",
);
const executableSql = migration.replace(/--.*$/gm, "");

assert.match(
  executableSql,
  /revoke\s+truncate\s+on\s+all\s+tables\s+in\s+schema\s+public\s+from\s+anon\s*,\s*authenticated\s*;/i,
  "Existing public tables must revoke TRUNCATE from anon and authenticated",
);
assert.match(
  executableSql,
  /alter\s+default\s+privileges\s+for\s+role\s+postgres\s+in\s+schema\s+public\s+revoke\s+truncate\s+on\s+tables\s+from\s+anon\s*,\s*authenticated\s*;/i,
  "Future public tables created by postgres must not grant TRUNCATE to browser roles",
);
assert.doesNotMatch(executableSql, /\b(drop|truncate)\s+table\b/i,
  "Migration must not delete or truncate data");
assert.doesNotMatch(executableSql, /\b(revoke|grant)\s+all\s+privileges\b/i,
  "Keep this migration narrowly scoped to TRUNCATE");
assert.match(migration, /does not alter[\s\S]*storage schemas/i,
  "Keep Supabase-managed storage schemas outside this migration");

console.log("Public TRUNCATE hardening contract checks passed.");
