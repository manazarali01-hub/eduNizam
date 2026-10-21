import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const workflow = readFileSync(
  new URL("../.github/workflows/deploy-supabase.yml", import.meta.url),
  "utf8",
);
const guardPath = new URL("./check-supabase-migration-history.sh", import.meta.url);

// Candidate historical migration files are checked for accidental drift only.
// The production ledger proves version/timestamp history, not original SQL text;
// this contract test is NOT proof of provenance. Resolve provenance separately
// before treating the production migration history as reconciled.
const recoveredAnonGrantMigration = readFileSync(
  new URL("../supabase/migrations/20261014170754_least_privilege_anon_table_grants.sql", import.meta.url),
  "utf8",
).trim();
assert.match(
  recoveredAnonGrantMigration,
  /revoke all privileges on all tables in schema public from anon;\s*grant insert on table public\.platform_feedback to anon;/s,
  "Candidate 20261014170754 SQL must match this reviewed contract; this does not establish production provenance",
);
const recoveredDefaultGrantMigration = readFileSync(
  new URL("../supabase/migrations/20261014170811_revoke_default_anon_table_grants.sql", import.meta.url),
  "utf8",
).trim();
assert.equal(
  recoveredDefaultGrantMigration,
  "alter default privileges for role postgres in schema public revoke all on tables from anon;",
  "Candidate 20261014170811 SQL must match this reviewed contract; this does not establish production provenance",
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
  /bash scripts\/check-supabase-migration-history\.sh/,
  "deployment must use the separately tested migration history guard",
);
assert.match(
  workflow,
  /supabase db push --dry-run[\s\S]*supabase db push/,
  "pending migrations must be previewed before application",
);

function checkMigrationHistory(input) {
  const directory = mkdtempSync(join(tmpdir(), "edunizam-migration-guard-"));
  const fixture = join(directory, "migration-list.txt");
  try {
    writeFileSync(fixture, input, "utf8");
    return spawnSync("bash", [guardPath.pathname, fixture], { encoding: "utf8" });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const missingArgument = spawnSync("bash", [guardPath.pathname], { encoding: "utf8" });
assert.notEqual(missingArgument.status, 0, "missing input argument must fail closed");
assert.match(missingArgument.stderr, /Readable migration-list output file is required/);

const missingFile = spawnSync("bash", [guardPath.pathname, new URL("./missing-migration-list-fixture.txt", import.meta.url).pathname], { encoding: "utf8" });
assert.notEqual(missingFile.status, 0, "missing input file must fail closed");
assert.match(missingFile.stderr, /Readable migration-list output file is required/);

const remoteOnly = [
  " LOCAL │ REMOTE │ TIME",
  "       │ 20261014170754 │ 2026-10-14 17:07:54",
].join("\n") + "\n";
const matching = [
  " LOCAL │ REMOTE │ TIME",
  " 20261020110000 │ 20261020110000 │ 2026-10-20 11:00:00",
].join("\n") + "\n";
const localOnly = [
  " LOCAL │ REMOTE │ TIME",
  " 20261020110000 │ │",
].join("\n") + "\n";
const matchingButUnverifiedProvenance = [
  " LOCAL │ REMOTE │ TIME",
  " 20261014170754 │ 20261014170754 │ 2026-10-14 17:07:54",
  " 20261014170811 │ 20261014170811 │ 2026-10-14 17:08:11",
].join("\n") + "\n";

const unrecognized = "migration versions unavailable\n";

const blocked = checkMigrationHistory(remoteOnly);
assert.notEqual(blocked.status, 0, "remote-only migrations must block deployment");
assert.match(blocked.stderr, /Remote-only migration history entry: 20261014170754/);

const matchingResult = checkMigrationHistory(matching);
assert.equal(matchingResult.status, 0, matchingResult.stderr || "ordinary matching versions should pass");

const provenanceBlocked = checkMigrationHistory(matchingButUnverifiedProvenance);
assert.notEqual(provenanceBlocked.status, 0, "matching filenames must not bypass unresolved SQL provenance");
assert.match(provenanceBlocked.stderr, /Unresolved migration SQL provenance: 20261014170754/);
assert.match(provenanceBlocked.stderr, /Unresolved migration SQL provenance: 20261014170811/);

const localOnlyResult = checkMigrationHistory(localOnly);
assert.equal(localOnlyResult.status, 0, localOnlyResult.stderr || "local-only pending migrations should pass the history guard");

const unknownResult = checkMigrationHistory(unrecognized);
assert.notEqual(unknownResult.status, 0, "unrecognized migration output must fail closed");
assert.match(unknownResult.stderr, /Could not recognize Supabase migration-list output/);

console.log("Production migration deployment guard contract and parser fixtures passed.");
