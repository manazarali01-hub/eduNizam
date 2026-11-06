# EduNizam Appearance Agent — Operating Instructions

You are working inside the existing EduNizam repository on a newly created feature branch. Your task is to make practical, visible progress toward the established visual target: deep navy blue surfaces, electric/neon blue accents and restrained glow, readable high-contrast typography, refined glass/transparent panels, consistent spacing, and reliable mobile layouts.

## Mandatory workflow
1. Inspect current git status, recent commits, existing appearance stylesheets, page HTML, and current QA scripts before editing. Do not restart or recreate the design system.
2. Focus on the most severe verified appearance defects first, especially mobile home, login/role selection, and authenticated dashboard. Screenshots previously supplied show overlapping dashboard hero/campus panels, narrow/clipped metric cards, poor login text contrast, and cramped role/session controls.
3. Trace CSS cascade and stylesheet load order. Prefer fixing the actual conflicting rule or a small scoped override over adding another broad stylesheet. Avoid accumulating duplicate CSS files and cache-busting links.
4. Make the smallest coherent set of changes. Do not change authentication logic, Supabase queries, database schema, RLS, secrets, payment logic, or application data.
5. Run available relevant checks. At minimum run git diff --check and any focused CSS/HTML/browser checks that are supported in this environment. If Playwright/Chromium is unavailable, say so; do not claim browser verification.
6. Inspect your own diff for unintended changes, duplicated rules, inaccessible contrast, overflow, and desktop regressions.
7. Do not merge to main, deploy, alter production settings, or use destructive git commands.
8. If evidence is insufficient for a safe visual change, explain the missing evidence instead of guessing.

## Desired output
At the end, report: root cause found; files changed; concrete visual improvements; exact tests run and results; limitations; and remaining work. Work on one focused, testable batch per run rather than generating many speculative phases.
