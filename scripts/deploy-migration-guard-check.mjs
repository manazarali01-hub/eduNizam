import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const workflow = readFileSync(
  new URL("../.github/workflows/deploy-supabase.yml", import.meta.url),
  "utf8",
);

assert.match(
  workflow,
  /concurrency:\s*\n\s*group:\s*edunizam-production-supabase-deploy\s*\n\s*cancel-in-progress:\s*false/,
  "production Supabase deployments must be serialized and never canceled mid-migration",
);

assert.match(
  workflow,
  /supabase migration list --linked/,
  "deployment must inspect the linked production migration ledger",
);

assert.match(
  workflow,
  /Could not recognize Supabase migration-list output; refusing deployment/,
  "unrecognized migration-list output must fail closed",
);

assert.match(
  workflow,
  /Remote-only migration history entry/,
  "deployment must detect remote migration versions with no local SQL file",
);

assert.match(
  workflow,
  /Production has remote-only migration versions with no matching local SQL/,
  "remote-only migration history must block production deployment",
);

const preview = workflow.indexOf("run: supabase db push --dry-run");
const apply = workflow.indexOf("run: supabase db push\n");
assert.ok(preview >= 0 && apply > preview, "pending migrations must be previewed before application");

console.log("Production migration deployment guard contract checks passed.");
