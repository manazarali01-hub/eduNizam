import fs from "node:fs";
import assert from "node:assert/strict";

const sql = fs.readFileSync(
  "supabase/migrations/20261020080000_revoke_ai_usage_sequence_app_privileges.sql",
  "utf8"
);
const executableSql = sql.replace(/--.*$/gm, "");

assert.match(
  executableSql,
  /revoke\s+all\s+on\s+sequence\s+public\.ai_usage_logs_id_seq\s+from\s+anon\s*,\s*authenticated\s*;/i,
  "The AI usage identity sequence must not be directly accessible to browser roles"
);
assert.doesNotMatch(executableSql, /alter\s+table|drop\s+policy|create\s+policy/i,
  "Sequence hardening must not change table schema or RLS");
assert.doesNotMatch(executableSql, /revoke\s+(select|insert|update|delete)\b/i,
  "Sequence hardening must not change ordinary table CRUD grants");
assert.doesNotMatch(executableSql, /alter\s+default\s+privileges/i,
  "Keep this change scoped to the one verified existing sequence");

console.log("AI usage sequence privilege migration contract checks passed.");
