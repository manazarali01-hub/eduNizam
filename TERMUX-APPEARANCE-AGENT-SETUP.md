# EduNizam Termux Appearance Agent

This local agent uses the Codex CLI to inspect and edit this existing checkout. It creates a separate feature branch for each run. It never merges or deploys.

## Requirements
- Termux with Git and Node.js
- Codex CLI installed and authenticated locally
- A clean Git working tree before each run

## Run
From the repository root:

```bash
bash scripts/termux-appearance-agent.sh
```

Optional: push the agent's successful changes to its isolated feature branch after local diff validation:

```bash
EDUNIZAM_AUTO_PUSH=1 bash scripts/termux-appearance-agent.sh
```

Pushing a feature branch does not merge or deploy it. Review the diff and wait for GitHub Actions before opening/merging a PR.

## Safety
The agent must not change auth, Supabase, database, RLS, secrets, payment logic, or production configuration. It refuses to start if the working tree is dirty. It never runs reset --hard or force-push.
