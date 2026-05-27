# SPEC 02 — Friendly Project Names

## Goal

The left sidebar and page title must show human-friendly project names.

The user should not see raw technical IDs such as:

```text
com.unity.multiplayer.center
```

as the main project name.

They should see:

```text
Unity Multiplayer Center
```

Raw technical names may still appear in technical details or the repo view.

## Required implementation

Add helper functions in `apps/windows/src/App.tsx` unless there is a better existing local helper file.

Recommended signatures:

```ts
function getProjectDisplayName(
  project: Project,
  analysis?: ProjectAnalysisSnapshot,
): string

function humanizeProjectName(value: string): string
```

## Name source priority

Use this priority order:

1. If the project has a manually edited display name field, use it.
2. If `analysis.summary.detectedName` exists and is not empty and not `"unknown"`, use it.
3. Use `project.name`.
4. Fallback to `"Untitled project"`.

Do not add a persistent display name field unless the existing schema already supports it. This spec is primarily about computed display names.

## Humanization rules

`humanizeProjectName(value)` must:

1. Trim whitespace.
2. Remove technical namespace prefixes:
   - `com.`
   - `org.`
   - `io.`
   - `net.`
   - `app.`
3. Replace separators with spaces:
   - `.`
   - `_`
   - `-`
4. Collapse repeated whitespace.
5. Title-case words.
6. Preserve short all-caps words if they already exist, such as `API`, `UI`, `UX`, `PCC`.
7. Return `"Untitled project"` if the result is empty.

## Examples

```ts
humanizeProjectName("com.unity.multiplayer.center")
// "Unity Multiplayer Center"

humanizeProjectName("pptv-web")
// "PPTV Web"

humanizeProjectName("my_private_repo")
// "My Private Repo"

humanizeProjectName("PCC")
// "PCC"
```

## UI usage

Use `getProjectDisplayName(...)` in:

- Left sidebar project list.
- Active page title.
- Today view project rows.
- Resume/recommended project cards.
- Repo view friendly title.

Use raw `project.name` only in:

- Repo details.
- Technical details.
- Debug/scan metadata.
- Paths.
- Codex handoff context if useful.

## Acceptance criteria

- Sidebar no longer shows `com.unity.multiplayer.center` as the primary label.
- Page title for that imported project shows `Unity Multiplayer Center`.
- Raw technical project name is still available in repo/technical detail.
- No persistent data migration is required.
- Existing project selection still works.
