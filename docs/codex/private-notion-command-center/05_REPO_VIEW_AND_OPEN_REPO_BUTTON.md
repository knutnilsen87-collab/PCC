# SPEC 05 — Repo View and Open Repo Button

## Goal

Add a direct way to open the repo/project technical route from the active project.

The user asked for a direct button to the repo route.

## Required topbar action

When `activeProject` exists, show a secondary button in the topbar:

```text
Open repo
```

Use an icon only if one already exists in the imports, such as `FolderOpen`.

Click behavior:

```ts
setViewMode("repo");
```

## Button hierarchy

`Open repo` is secondary.

It must not visually compete with the main project action, such as `Resume project`.

## RepoView component

Create a `RepoView` component in `App.tsx`.

Recommended signature:

```ts
function RepoView({
  project,
  analysis,
  onBackToProject,
  onRescan,
  onGenerateCodexHandoff,
}: {
  project: Project;
  analysis?: ProjectAnalysisSnapshot;
  onBackToProject: () => void;
  onRescan: () => void;
  onGenerateCodexHandoff: () => void;
})
```

Adapt to existing handler names.

## Required RepoView content

### Header

```text
Repo
Unity Multiplayer Center
```

### Project path

Show:

```text
Project path
[selected-folder]/com.unity.multiplayer.center
```

Use `project.localFolderPath` if available.

If path is not available:

```text
Path unavailable. Re-import the folder to restore browser folder access.
```

### Raw technical name

Show:

```text
Raw project name
com.unity.multiplayer.center
```

### Repo/scan status

Show scan facts from `analysis` if available:

- total files scanned
- total files skipped
- detected frameworks
- detected languages
- warnings
- skipped reasons
- whether Git metadata was detected, if available

### Important files

Use:

```ts
analysis.files.importantFiles
```

Render up to 10.

Each item:

```text
main/AndroidManifest.xml
Likely workflow or entrypoint
```

### Attention

Show:

- risks
- warnings
- skipped areas
- blockers

### Actions

Show:

```text
[Back to project]
[Run deeper scan]
[Generate Codex handoff]
```

Do not run commands automatically.

`Run deeper scan` should call the existing read-only rescan handler.

`Generate Codex handoff` should call the existing assistant quick action if available:

```ts
onAssistantQuickAction("Generate Codex handoff")
```

## CSS classes

Use:

```text
repo-view
repo-header
repo-meta-grid
repo-section
repo-file-list
repo-actions
```

## Acceptance criteria

- `Open repo` appears when a project is active.
- Clicking `Open repo` changes the main workspace to repo view.
- Repo view shows friendly project name and raw technical name.
- Important files are visible without opening technical scan details.
- Technical information is isolated to repo view, not forced into the daily Today view.
- No shell commands are executed.
- No imported files are modified.
