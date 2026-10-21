import fs from "node:fs";
import assert from "node:assert/strict";

const path = "supabase/manual/data-api-table-grants-checklist.md";
const doc = fs.readFileSync(path, "utf8");

for (const [pattern, message] of [
  [/30 October 2026/, "Document the announced effective date"],
  [/same migration/, "Require grants in the table-creation migration"],
  [/Row Level Security \(RLS\)/, "Require RLS review"],
  [/anon.*authenticated/s, "Cover both browser-facing roles"],
  [/service_role/, "Warn about service-role secrets"],
  [/has_table_privilege/, "Include an effective table-privilege audit"],
  [/Audit future-table default privileges/, "Include a future default-ACL audit"],
  [/20261014170754.*20261014170811/s, "Document candidate historical migration versions"],
  [/production ledger confirms version\/timestamp history, but does not preserve the original SQL text/s, "Explain the migration ledger provenance limit"],
  [/candidate files.*exact SQL provenance is not independently verified/s, "Do not overstate candidate SQL provenance"],
  [/contract tests can detect drift from expected strings, but cannot prove those strings are the statements originally applied/s, "Distinguish contract tests from provenance evidence"],
  [/PR #182 remains open and unmerged.*not be treated as released or as authoritative history reconciliation/s, "Keep proposed files unreleased and history unreconciled"],
  [/Do not apply any SQL to production/, "Explicitly prohibit production changes from this checklist"]
]) {
  assert.match(doc, pattern, message);
}

assert.match(doc, /-- grant select on table public\.example_table to anon;/,
  "Grant examples must remain commented and table-specific, not blanket executable grants");
assert.match(doc, /alter table public\.example_table enable row level security;/,
  "Show RLS as part of the example table setup");
assert.match(doc, /service_role.*server-side/s,
  "Keep service-role credentials server-side");

console.log("Supabase Data API grants checklist contract checks passed.");
