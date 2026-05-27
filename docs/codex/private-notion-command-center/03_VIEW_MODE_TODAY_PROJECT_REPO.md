# SPEC 03 — View Mode: Today / Project / Repo

## Goal

The app should not always render the selected project page as the default surface.

Add a simple UI view mode so the app can open on `Today`, then switch to `Project` or `Repo`.

## Required type

Add a UI-only type in `App.tsx`:

```ts
type ViewMode = "today" | "project" | "repo";
```

Add state:

```ts
const [viewMode, setViewMode] = useState<ViewMode>("today");
```

## Behavior

### App startup

Default view:

```ts
"today"
```

The app should open on Today even if projects already exist.

### Selecting a project

When the user clicks a project in the sidebar:

```ts
setActiveProjectId(project.id);
setViewMode("project");
```

### Importing a folder

After import completes:

```ts
setActiveProjectId(result.projectId);
setViewMode("project");
```

Reason: import is an explicit user action, so showing the imported project is okay.

### Creating a project

After create completes:

```ts
setActiveProjectId(nextProject.id);
setViewMode("project");
```

### Open repo

`Open repo` sets:

```ts
setViewMode("repo");
```

### Back to project

Repo view must have a `Back to project` action:

```ts
setViewMode("project");
```

### Today navigation

Sidebar must include a Today item:

```text
Today
```

Clicking it sets:

```ts
setViewMode("today");
```

## Rendering structure

Use a simple conditional render:

```tsx
{viewMode === "today" ? (
  <TodayView ... />
) : viewMode === "repo" && activeProject ? (
  <RepoView ... />
) : activeProject ? (
  <ProjectSurface ... />
) : (
  <EmptyState ... />
)}
```

## Header behavior

The topbar should reflect the current view:

- Today view title: `Today`
- Project view title: friendly project name
- Repo view title: `Repo`

Do not show an archive button on Today unless it clearly applies to an active project.

## Acceptance criteria

- Reloading the app opens Today.
- Clicking a sidebar project opens the project view.
- Importing or creating a project opens the project view.
- `Open repo` opens the repo view.
- `Back to project` returns to the active project.
- No routing library is added.
