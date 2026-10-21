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

// SQL string literals may legitimately mention privilege names such as 'TRUNCATE'.
// Remove them before looking for executable mutation keywords.
function withoutStringLiterals(statement) {
  return statement.replace(/'(?:''|[^'])*'/g, "''");
}

const mutation = /\b(?:insert|update|delete|truncate|grant|revoke|alter|drop|create|call|do|commit|rollback|copy|execute|prepare|refresh|vacuum|analyze)\b/i;

assert.match(sql, /read-only audit/i, "Document that this is a read-only audit");
assert.match(executable, /has_table_privilege\s*\(/i, "Audit effective table privileges");
assert.match(executable, /n\.nspname\s+in\s*\('public',\s*'storage'\)/i, "Audit public and Storage tables");
assert.match(executable, /not\s+c\.relrowsecurity/i, "Find public tables without RLS");
assert.match(executable, /pg_default_acl/i, "Inspect future-table default ACLs");
assert.match(executable, /graphql_public/i, "Include Supabase-managed API schemas in default ACL review");
assert.match(executable, /acl\.privilege_type\s*=\s*'TRUNCATE'/i, "Scope default ACL review to TRUNCATE");

// Check every statement independently, including mutation keywords appended to
// a SELECT on the same line. String literals are ignored to avoid false positives.
assert.equal(statements.length, 3, "Audit should contain exactly three read-only queries");
for (const [index, statement] of statements.entries()) {
  assert.match(
    statement,
    /^select\b/i,
    `Audit statement ${index + 1} must be a SELECT query`,
  );
  assert.doesNotMatch(
    withoutStringLiterals(statement),
    mutation,
    `Audit statement ${index + 1} must not contain an executable mutation`,
  );
}

// Regression canaries: catch a same-statement mutation but allow privilege names
// mentioned as data in a quoted string.
assert.match(withoutStringLiterals("SELECT 'TRUNCATE' AS privilege_name"), /^SELECT\b/i);
assert.doesNotMatch(withoutStringLiterals("SELECT 'TRUNCATE' AS privilege_name"), mutation);
assert.match(withoutStringLiterals("SELECT 1 DROP TABLE sensitive_data"), mutation);
assert.match(withoutStringLiterals("SELECT 1; REVOKE ALL ON TABLE t FROM anon"), mutation);

console.log("Supabase read-only privilege audit contract checks passed.");
