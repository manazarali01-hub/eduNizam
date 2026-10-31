#!/usr/bin/env bash
# Fail closed when production has migration versions without matching local SQL.
set -euo pipefail

if [ "$#" -ne 1 ] || [ ! -f "$1" ] || [ ! -r "$1" ]; then
  echo "::error::Readable migration-list output file is required; refusing deployment." >&2
  exit 2
fi

if ! grep -q 'LOCAL.*REMOTE' "$1"; then
  echo "::error::Could not recognize Supabase migration-list output; refusing deployment." >&2
  exit 2
fi

# Validate every migration row before making a release decision. A header-only or
# malformed table must not be mistaken for a clean migration history.
set +e
awk -F '│' '
  /LOCAL.*REMOTE/ { header = 1; next }
  index($0, "│") == 0 {
    # Ignore blank lines and box-drawing borders, but reject stray text rows:
    # otherwise a malformed row could be silently skipped beside valid rows.
    if ($0 ~ /[[:alnum:]]/) {
      print "Malformed migration-list row: " $0 > "/dev/stderr"
      invalid = 1
    }
    next
  }
  $0 !~ /[[:alnum:]]/ { next }
  {
    if (NF < 3) {
      print "Malformed migration-list row: " $0 > "/dev/stderr"
      invalid = 1
      next
    }
    local_version = $1
    remote_version = $2
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", local_version)
    gsub(/^[[:space:]]+|[[:space:]]+$/, "", remote_version)
    if ((local_version != "" && (length(local_version) != 14 || local_version ~ /[^0-9]/)) ||
        (remote_version != "" && (length(remote_version) != 14 || remote_version ~ /[^0-9]/)) ||
        (local_version == "" && remote_version == "")) {
      print "Malformed migration version row: " $0 > "/dev/stderr"
      invalid = 1
    }
    rows++
  }
  END {
    if (!header || rows == 0) {
      print "Migration-list output contains no recognizable migration rows." > "/dev/stderr"
      invalid = 1
    }
    exit invalid ? 1 : 0
  }
' "$1"
validation_status=$?
set -e
if [ "$validation_status" -ne 0 ]; then
  echo "::error::Migration history output failed validation; refusing deployment." >&2
  exit 2
fi

set +e
awk -F '│' '
  NF >= 3 {
    local_version = $1
    remote_version = $2
    gsub(/[[:space:]]/, "", local_version)
    gsub(/[[:space:]]/, "", remote_version)
    if (local_version == "" && length(remote_version) == 14 && remote_version ~ /^[0-9]+$/) {
      print "Remote-only migration history entry: " remote_version > "/dev/stderr"
      found = 1
    }
  }
  END { exit found ? 0 : 1 }
' "$1"
awk_status=$?
set -e

case "$awk_status" in
  0)
    echo "::error::Production has remote-only migration versions with no matching local SQL. Reconcile from an authoritative source before deployment." >&2
    exit 1
    ;;
  1)
    echo "Linked migration history contains no remote-only version entries."
    ;;
  *)
    echo "::error::Could not safely parse linked migration history; refusing deployment." >&2
    exit 2
    ;;
esac
