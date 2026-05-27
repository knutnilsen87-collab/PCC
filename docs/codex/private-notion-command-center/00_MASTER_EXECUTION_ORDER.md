# CODEX MASTER SPEC — Private Notion Command Center Makeover

## Purpose

This folder is the single source of truth for the next implementation pass.

Codex must execute only the specs in this folder. Do not invent new features, do not refactor unrelated modules, and do not change domain behavior unless a spec explicitly says so.

## Product goal

Transform Project Command Center from a technical import/scan dashboard into a private, Notion-like daily work command center.

When the user opens the app at the start of the workday, they should quickly understand:

1. Which projects exist.
2. Which projects need attention.
3. Which project should be resumed first.
4. What the next exact action is.
5. How to open the repo/project route directly.

## Existing repo assumptions

The current repo is a TypeScript workspace with a Windows app under:

```text
apps/windows/src/
```

The primary files for this makeover are expected to be:

```text
apps/windows/src/App.tsx
apps/windows/src/styles.css
apps/windows/src/importOverview.ts
```

Do not move files unless one of the task specs explicitly instructs you to do so.

## Required execution order

Run the specs in this exact order:

1. `01_RULES_AND_GUARDRAILS.md`
2. `02_FRIENDLY_PROJECT_NAMES.md`
3. `03_VIEW_MODE_TODAY_PROJECT_REPO.md`
4. `04_TODAY_START_SCREEN.md`
5. `05_REPO_VIEW_AND_OPEN_REPO_BUTTON.md`
6. `06_PROJECT_SURFACE_REDESIGN.md`
7. `07_NOTION_DARK_VISUAL_SYSTEM.md`
8. `08_ASSISTANT_BAR_AND_MICROCOPY.md`
9. `09_QA_AND_ACCEPTANCE.md`

## What counts as done

This pass is done only when all of these are true:

- The app opens on a Today view, not a technical import detail view.
- Left sidebar project names are human readable.
- Example: `com.unity.multiplayer.center` becomes `Unity Multiplayer Center`.
- The active project has a direct `Open repo` button.
- Project pages are calmer and less visually overwhelming.
- Technical scan details are still available, but secondary and collapsed.
- The visual system has stronger contrast between sidebar, page background, cards and buttons.
- The UI feels more like a private Notion workspace than a SaaS analytics dashboard.
- Existing assistant and approval behavior still works.
- No new dependencies are added.
- Typecheck, test and build pass.

## Required checks

Run these after implementation:

```bash
pnpm typecheck
pnpm test
pnpm build
```

If `pnpm` is unavailable, use the repo's documented package manager flow and explain exactly what changed.

## Diff requirements

Before finalizing, show a concise summary of changed files and the reason for each change.

Do not include unrelated formatting churn.
