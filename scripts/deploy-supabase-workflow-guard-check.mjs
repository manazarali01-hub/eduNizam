import assert from "node:assert/strict";
import fs from "node:fs";

const workflow = fs.readFileSync(".github/workflows/deploy-supabase.yml", "utf8");

function verifyDeployGuard(source) {
  assert.match(source, /workflow_dispatch:/,
    "Production database deployment must remain manually triggered");
  assert.match(source, /group:\s*edunizam-production-supabase-deploy[\s\S]*?cancel-in-progress:\s*false/,
    "Production migration deployments must be serialized and not cancelled mid-flight");

  const guard = source.indexOf("bash scripts/check-supabase-migration-history.sh");
  const preview = source.indexOf("supabase db push --dry-run");
  const apply = source.indexOf("supabase db push\n");
  assert.notEqual(guard, -1, "Deployment must execute the migration-history guard");
  assert.notEqual(preview, -1, "Deployment must preview pending migrations");
  assert.notEqual(apply, -1, "Deployment must apply migrations only after preview");
  assert.ok(guard < preview && preview < apply,
    "Migration history guard must run before preview and apply");

  assert.doesNotMatch(source, /supabase\s+migration\s+repair\b/i,
    "Deployment must not automatically repair unresolved migration history");
  assert.doesNotMatch(source, /supabase\s+db\s+push[^\n]*--include-all/i,
    "Deployment must not bypass migration reconciliation with --include-all");
  assert.equal((source.match(/supabase db push\n/g) || []).length, 1,
    "Workflow should have exactly one migration-apply command");
}

verifyDeployGuard(workflow);

// Regression canaries: removing the guard or moving it after apply must fail.
assert.throws(() => verifyDeployGuard(workflow.replace(
  "bash scripts/check-supabase-migration-history.sh /tmp/supabase-migration-list.txt",
  "echo skipped migration history guard",
)), /execute the migration-history guard/);

const applyCommand = "supabase db push\n";
const previewCommand = "supabase db push --dry-run";
assert.throws(() => verifyDeployGuard(workflow.replace(
  previewCommand,
  "supabase db push\n# preview removed\n" + previewCommand,
)), /preview and apply/);

console.log("Supabase deployment migration-guard workflow contract checks passed.");
