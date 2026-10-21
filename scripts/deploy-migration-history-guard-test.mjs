import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const guard = new URL("./check-supabase-migration-history.sh", import.meta.url);
function run(input) {
  const dir = mkdtempSync(join(tmpdir(), "edunizam-migration-history-"));
  const file = join(dir, "migration-list.txt");
  try {
    writeFileSync(file, input, "utf8");
    return spawnSync("bash", [guard.pathname, file], { encoding: "utf8" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const remoteOnly = run([
  " LOCAL │ REMOTE │ TIME",
  "       │ 20261014170754 │ 2026-10-14 17:07:54",
].join("\n") + "\n");
assert.notEqual(remoteOnly.status, 0, "remote-only versions must block deploy");
assert.match(remoteOnly.stderr, /Remote-only migration history entry: 20261014170754/);

const matching = run([
  " LOCAL │ REMOTE │ TIME",
  " 20261020110000 │ 20261020110000 │ 2026-10-20 11:00:00",
].join("\n") + "\n");
assert.equal(matching.status, 0, matching.stderr || "matching history should pass");

const localOnly = run([
  " LOCAL │ REMOTE │ TIME",
  " 20261021120000 │ │",
].join("\n") + "\n");
assert.equal(localOnly.status, 0, localOnly.stderr || "pending local migrations should pass the history guard");

const unrecognized = run("migration versions unavailable\n");
assert.notEqual(unrecognized.status, 0, "unrecognized output must fail closed");
assert.match(unrecognized.stderr, /Could not recognize Supabase migration-list output/);

console.log("Production migration history guard fixtures passed.");
