#!/data/data/com.termux/files/usr/bin/bash
# Read-only local diagnostics for EduNizam in Termux.
set -eu

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [ -z "$ROOT" ]; then
  echo "ERROR: Run this script from inside the EduNizam Git repository."
  exit 1
fi
cd "$ROOT"

echo "EduNizam Termux Doctor"
echo "======================"
printf 'Repository: %s\n' "$ROOT"
printf 'Branch: %s\n' "$(git branch --show-current)"
printf 'HEAD: %s\n' "$(git rev-parse --short HEAD)"
printf 'Remote: %s\n' "$(git remote get-url origin 2>/dev/null || echo 'origin not configured')"

echo
echo "Tool availability:"
for cmd in git node npm python curl; do
  if command -v "$cmd" >/dev/null 2>&1; then
    printf '  [OK] %-8s %s\n' "$cmd" "$(command -v "$cmd")"
  else
    printf '  [--] %-8s not installed\n' "$cmd"
  fi
done

echo
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
  printf 'Node.js: %s\n' "$(node --version)"
  if [ "$NODE_MAJOR" -ge 22 ]; then
    echo "[OK] Node.js 22+ meets the repository QA runtime."
  else
    echo "[WARN] Repository CI uses Node.js 22. Upgrade Node before running full QA."
  fi
else
  echo "[WARN] Install Node.js to run repository checks."
fi

echo
if [ -f qa-check.mjs ]; then echo "[OK] qa-check.mjs found"; else echo "[WARN] qa-check.mjs missing"; fi
if [ -f scripts/repo-smoke-check.mjs ]; then echo "[OK] repository smoke check found"; else echo "[WARN] repository smoke check missing"; fi

echo
if [ -n "$(git status --porcelain)" ]; then
  echo "[WARN] Working tree has local changes. Review them before pull, checkout or reset."
  git status --short
else
  echo "[OK] Working tree clean."
fi

echo
echo "No files, credentials, database settings or Git refs were changed."
