# Single Prompt for Codex

Use this prompt if you want Codex to execute the entire spec pack in one run.

```text
You are working in the Project Command Center repository.

Your only task is to implement the spec pack located at:

docs/codex/private-notion-command-center/

Read and follow these files in order:

1. 00_MASTER_EXECUTION_ORDER.md
2. 01_RULES_AND_GUARDRAILS.md
3. 02_FRIENDLY_PROJECT_NAMES.md
4. 03_VIEW_MODE_TODAY_PROJECT_REPO.md
5. 04_TODAY_START_SCREEN.md
6. 05_REPO_VIEW_AND_OPEN_REPO_BUTTON.md
7. 06_PROJECT_SURFACE_REDESIGN.md
8. 07_NOTION_DARK_VISUAL_SYSTEM.md
9. 08_ASSISTANT_BAR_AND_MICROCOPY.md
10. 09_QA_AND_ACCEPTANCE.md

Do not implement anything outside these specs.

Core intent:
Transform the app from a technical import dashboard into a private Notion-like daily command center.

Required outcomes:
- App opens on Today.
- Sidebar uses friendly project names.
- com.unity.multiplayer.center becomes Unity Multiplayer Center.
- Active project has an Open repo button.
- Repo view exists.
- Project page focuses on Next action.
- Technical scan details are secondary/collapsed.
- UI has stronger contrast and less glow.
- Assistant remains fixed at bottom.
- Existing AI approval behavior remains intact.
- No dependencies are added.
- No domain logic is rewritten.

Run:
pnpm typecheck
pnpm test
pnpm build

Show changed files, checks, and a short implementation summary.
```
