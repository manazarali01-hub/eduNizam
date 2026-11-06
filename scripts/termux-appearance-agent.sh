#!/data/data/com.termux/files/usr/bin/bash
set -Eeuo pipefail

ROOT="${EDUNIZAM_ROOT:-$HOME/projects/eduNizam}"
PROMPT_FILE="$ROOT/TERMUX-APPEARANCE-AGENT.md"
STAMP="$(date +%Y%m%d-%H%M%S)"
BRANCH="agent/appearance-$STAMP"

fail(){ printf '\n[STOP] %s\n' "$1" >&2; exit 1; }
info(){ printf '\n[EduNizam Agent] %s\n' "$1"; }

[ -d "$ROOT/.git" ] || fail "Repo nahi mila: $ROOT"
cd "$ROOT"
command -v git >/dev/null 2>&1 || fail "Git install nahi."
command -v node >/dev/null 2>&1 || fail "Node.js install nahi."
command -v codex >/dev/null 2>&1 || fail "Codex CLI install nahi. TERMUX-SETUP.md ka agent setup dekhein."
[ -f "$PROMPT_FILE" ] || fail "Agent instructions file missing."

if [ -n "$(git status --porcelain)" ]; then
  git status --short
  fail "Working tree clean nahi. Pehle apne changes commit ya backup karein; agent unhein overwrite nahi karega."
fi

info "Remote main se latest changes fetch kar raha hai..."
git fetch origin main
git switch main
git pull --ff-only origin main
[ -z "$(git status --porcelain)" ] || fail "Main branch clean nahi."

info "Is run ke liye isolated feature branch bana raha hai: $BRANCH"
git switch -c "$BRANCH"

info "Appearance agent start. Sirf frontend appearance scope; auth/database/security untouched."
set +e
codex exec --sandbox workspace-write --ask-for-approval on-request "$(cat "$PROMPT_FILE")"
CODEX_STATUS=$?
set -e

if [ "$CODEX_STATUS" -ne 0 ]; then
  info "Codex run exit code $CODEX_STATUS. Changes inspect karein; automatic push nahi kiya."
  git status --short
  exit "$CODEX_STATUS"
fi

info "Local diff validation..."
git diff --check
if [ -z "$(git status --porcelain)" ]; then
  info "Koi code change nahi hua. Agent ne change zaroori nahi samjha ya task incomplete raha."
  exit 0
fi

git status --short
git diff --stat
info "Changes local feature branch par hain. Review ke baghair main, production ya deployment par push/merge nahi hoga."
if [ "${EDUNIZAM_AUTO_PUSH:-0}" = "1" ]; then
  git add -A
  git commit -m "Improve EduNizam responsive appearance"
  git push -u origin HEAD
  info "Feature branch push ho gayi. PR/merge/deploy alag approval aur CI ke baad."
else
  info "Auto-push off hai. Review ke baad push karne ke liye EDUNIZAM_AUTO_PUSH=1 ke sath dobara run karein, ya manual review karein."
fi
