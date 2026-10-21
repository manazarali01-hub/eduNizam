import assert from "node:assert/strict";
import fs from "node:fs";

const sql = fs.readFileSync("scripts/supabase-readonly-privilege-audit.sql", "utf8");
const executable = sql
  .replace(/--.*$/gm, "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .trim();
const statements = executable
  .split(";")
  .map((statement) => statement.trim())
  .filter(Boolean);

assert.match(sql, /read-only audit/i, "Document that this is a read-only audit");
assert.match(executable, /has_table_privilege\s*\(/i, "Audit effective table privileges");
assert.match(executable, /n\.nspname\s+in\s*\('public',\s*'storage'\)/i, "Audit public and Storage tables");
assert.match(executable, /not\s+c\.relrowsecurity/i, "Find public tables without RLS");
assert.match(executable, /pg_default_acl/i, "Inspect future-table default ACLs");
assert.match(executable, /graphql_public/i, "Include Supabase-managed API schemas in default ACL review");
assert.match(executable, /acl\.privilege_type\s*=\s*'TRUNCATE'/i, "Scope default ACL review to TRUNCATE");

// Validate each statement independently. This catches an extra mutation appended
// after a SELECT even when both commands appear on the same line.
assert.equal(statements.length, 3, "Audit should contain exactly three read-only queries");
for (const [index, statement] of statements.entries()) {
  assert.match(
    statement,
    /^select\b/i,
    `Audit statement ${index + 1} must be a SELECT query`,
  );
}

console.log("Supabase read-only privilege audit contract checks passed.");
