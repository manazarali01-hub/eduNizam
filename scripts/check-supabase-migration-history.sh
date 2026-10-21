#!/usr/bin/env bash
# Fail closed on remote-only versions and known versions whose SQL provenance is unresolved.
# Do not remove the provenance block until an authoritative original artifact is reviewed.
set -euo pipefail

if [ "$#" -ne 1 ] || [ ! -f "$1" ] || [ ! -r "$1" ]; then
  echo "::error::Readable migration-list output file is required; refusing deployment." >&2
  exit 2
fi

if ! grep -q 'LOCAL.*REMOTE' "$1"; then
  echo "::error::Could not recognize Supabase migration-list output; refusing deployment." >&2
  exit 2
fi

set +e
awk -F '│' '
  NF >= 3 {
    local_version = $1
    remote_version = $2
    gsub(/[[:space:]]/, "", local_version)
    gsub(/[[:space:]]/, "", remote_version)
    if (length(remote_version) == 14 && remote_version ~ /^[0-9]+$/) {
      if (remote_version == "20261014170754" || remote_version == "20261014170811") {
        print "Unresolved migration SQL provenance: " remote_version > "/dev/stderr"
        found = 1
      } else if (local_version == "") {
        print "Remote-only migration history entry: " remote_version > "/dev/stderr"
        found = 1
      }
    }
  }
  END { exit found ? 0 : 1 }
' "$1"
awk_status=$?
set -e

case "$awk_status" in
  0)
    echo "::error::Production migration history is unreconciled or contains versions with unresolved SQL provenance. Reconcile from an authoritative source before deployment." >&2
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
