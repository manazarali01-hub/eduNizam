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
assert.match(executable, /pg_default_acl/i, "Inspect future-object default ACLs");
assert.match(executable, /graphql_public/i, "Include Supabase-managed API schemas in default ACL review");
assert.match(executable, /acl\.privilege_type\s*=\s*'TRUNCATE'/i, "Scope the focused default-table check to TRUNCATE");
assert.match(executable, /has_sequence_privilege\s*\(/i, "Audit effective browser-role sequence privileges");
assert.match(executable, /c\.relkind\s*=\s*'S'/i, "Limit sequence audit to actual sequences");
assert.match(executable, /'USAGE'[\s\S]*'SELECT'[\s\S]*'UPDATE'/i, "Review all three PostgreSQL sequence privileges");
assert.match(executable, /Full browser-role default ACL inventory/i, "Document the expanded default ACL inventory");
assert.match(executable, /d\.defaclobjtype\s+in\s*\('r',\s*'S',\s*'f'\)/i, "Audit table, sequence, and function defaults");
assert.match(executable, /grantee\.rolname\s+in\s*\('anon',\s*'authenticated'\)/i, "Scope inventory to browser roles");
assert.match(executable, /acl\.privilege_type/i, "Report individual default privilege types");

assert.equal(statements.length, 5, "Audit should contain five read-only queries");
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
