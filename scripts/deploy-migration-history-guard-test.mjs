import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
function runArgs(args) {
  return spawnSync("bash", [guard.pathname, ...args], { encoding: "utf8" });
}

// Invalid invocation and missing/unreadable input must fail closed before parsing.
const missingArgument = runArgs([]);
assert.notEqual(missingArgument.status, 0, "missing argument must block deploy");
assert.match(missingArgument.stderr, /Readable migration-list output file is required/);

const missingFile = runArgs(["/path/that/does/not/exist/edunizam-migration-list.txt"]);
assert.notEqual(missingFile.status, 0, "missing file must block deploy");
assert.match(missingFile.stderr, /Readable migration-list output file is required/);

// Exercise the unreadable-file branch on non-root runners, where mode 000 is meaningful.
if (typeof process.getuid === "function" && process.getuid() !== 0) {
  const dir = mkdtempSync(join(tmpdir(), "edunizam-migration-history-unreadable-"));
  const file = join(dir, "migration-list.txt");
  try {
    writeFileSync(file, " LOCAL │ REMOTE │ TIME\n", "utf8");
    chmodSync(file, 0o000);
    const unreadableFile = runArgs([file]);
    assert.notEqual(unreadableFile.status, 0, "unreadable file must block deploy");
    assert.match(unreadableFile.stderr, /Readable migration-list output file is required/);
  } finally {
    chmodSync(file, 0o600);
    rmSync(dir, { recursive: true, force: true });
  }
}

const remoteOnly = run([
  " LOCAL │ REMOTE │ TIME",
  "       │ 20261015121212 │ 2026-10-15 12:12:12",
].join("\n") + "\n");
assert.notEqual(remoteOnly.status, 0, "remote-only versions must block deploy");
assert.match(remoteOnly.stderr, /Remote-only migration history entry: 20261015121212/);

const recoveredMatching = run([
  " LOCAL │ REMOTE │ TIME",
  " 20261014170754 │ 20261014170754 │ 2026-10-14 17:07:54",
  " 20261014170811 │ 20261014170811 │ 2026-10-14 17:08:11",
].join("\n") + "\n");
assert.equal(recoveredMatching.status, 0,
  recoveredMatching.stderr || "restored migration history should pass when local and remote versions match");

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

const headerOnly = run(" LOCAL │ REMOTE │ TIME\n");
assert.notEqual(headerOnly.status, 0, "header-only output must fail closed");
assert.match(headerOnly.stderr, /contains no recognizable migration rows|failed validation/);

const malformedVersion = run([
  " LOCAL │ REMOTE │ TIME",
  " garbage │ 20261015121212 │ 2026-10-15 12:12:12",
].join("\n") + "\n");
assert.notEqual(malformedVersion.status, 0, "malformed migration versions must block deploy");
assert.match(malformedVersion.stderr, /Malformed migration version row|failed validation/);

const strayRow = run([
  " LOCAL │ REMOTE │ TIME",
  " 20261020110000 │ 20261020110000 │ 2026-10-20 11:00:00",
  "unexpected migration row",
].join("\n") + "\n");
assert.notEqual(strayRow.status, 0,
  "stray non-table text must not be silently ignored beside valid migration rows");
assert.match(strayRow.stderr, /Malformed migration-list row|failed validation/);

console.log("Production migration history guard fixtures passed.");
