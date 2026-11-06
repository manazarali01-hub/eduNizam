# EduNizam on Android Termux

This guide sets up a **mobile Git + Node.js workflow** for the existing EduNizam repository. It does not replace GitHub Actions: the repository's full browser-layout and PostgreSQL integration checks should continue running in CI.

## 1. Install Termux safely

Install Termux from its official F-Droid listing or the official Termux GitHub releases. Avoid outdated Play Store builds.

Open Termux and run:

```bash
pkg update && pkg upgrade
pkg install git nodejs-lts python curl
```

The current EduNizam QA workflow uses **Node.js 22**. Confirm your installed version:

```bash
node --version
npm --version
git --version
```

If `node --version` is below v22, update the Termux Node.js package before running the complete QA suite.

## 2. Clone EduNizam

```bash
mkdir -p ~/projects
cd ~/projects
git clone https://github.com/manazarali01-hub/eduNizam.git
cd eduNizam
```

If the repository is already cloned, do not clone it again:

```bash
cd ~/projects/eduNizam
git status
git pull --ff-only
```

Only pull when your working tree is clean. If Git reports local changes, inspect and commit or safely back them up first; do not use `git reset --hard`.

## 3. Run the Termux environment check

From the repository root:

```bash
bash scripts/termux-doctor.sh
```

This read-only diagnostic reports Git, Node, Python and curl availability, current branch/commit, working-tree status and required QA files. It does not install packages or modify project files.

## 4. Run EduNizam checks locally

Run the same core Node checks used by the repository workflows:

```bash
node qa-check.mjs
node scripts/repo-smoke-check.mjs
```

For a focused change, run its corresponding check from `.github/workflows/qa.yml`, for example:

```bash
node scripts/public-metadata-consistency-check.mjs
node scripts/public-internal-link-check.mjs
node scripts/auth-session-race-check.mjs
```

Run checks from the repository root. A failure must be investigated; do not treat a command that was not run as passed.

## 5. Edit, review and push safely

Use a feature branch; do not work directly on `main`:

```bash
git switch -c my-change
# edit files with your preferred Termux editor
git diff --check
git diff
git status --short
```

After relevant checks pass:

```bash
git add path/to/changed-file
git commit -m "Describe the focused change"
git push -u origin HEAD
```

Then open a Pull Request on GitHub and wait for required CI. A successful push or merged PR is **not proof of production deployment**. GitHub Pages deployment must complete its own workflow and live verification.

## 6. Browser QA limitation on Android

The repository's browser QA installs pinned Playwright and Chromium on Ubuntu runners. Native Android/Termux is not the supported environment for that full browser suite. Keep these checks in GitHub Actions:

- rendered responsive/mobile layout checks
- mobile sidebar browser interactions
- Teacher / Student / Parent browser workflow regressions
- disposable PostgreSQL integration tests

Use the GitHub Actions run as the evidence for those checks; local Termux Node checks do not replace them.

## 7. Security rules

- Never store Supabase service-role keys, database passwords, payment secrets or AI provider keys in the repository, shell history, screenshots or browser JavaScript.
- Do not run production SQL migrations or change Supabase Auth/RLS settings from this mobile workflow without a separately reviewed and approved change.
- Do not use `git push --force`, `git reset --hard` or destructive cleanup commands as routine troubleshooting.
- Keep personal access tokens out of clone URLs. If Git prompts for authentication, use GitHub's supported secure authentication flow; never paste a token into chat.

## Useful daily sequence

```bash
cd ~/projects/eduNizam
git status
git pull --ff-only
bash scripts/termux-doctor.sh
node qa-check.mjs
git diff --check
```
