# SPEC 04 — Today Start Screen

## Goal

Create a calm, private start-of-workday overview.

This is the screen the user sees first each morning.

It should answer:

```text
What do I have?
What needs attention?
What should I resume first?
```

## Component

Create a `TodayView` component in `apps/windows/src/App.tsx`.

Recommended signature:

```ts
function TodayView({
  state,
  activeProjectId,
  onSelectProject,
}: {
  state: AppState;
  activeProjectId?: string;
  onSelectProject: (projectId: string) => void;
})
```

Adjust props if needed to match existing code.

## Required content

### 1. Header

Show:

```text
Today
Good morning, Knut.
```

If you do not want hardcoded personalization, use:

```text
Good morning.
```

But the preferred version for this private app is:

```text
Good morning, Knut.
```

### 2. Summary line

Show a short line:

```text
You have 2 active projects, 1 blocked project, and 1 project ready to resume.
```

Compute from existing state.

### 3. Best next move

Show one prominent recommendation.

Example:

```text
Best next move
Resume Unity Multiplayer Center

Next:
Review the skipped summary, then run a scoped rescan if the missing areas matter.

[Resume project]
```

## Recommendation logic

Pick the recommended project in this order:

1. Active non-archived project with open blockers.
2. Active non-archived project with a resume snapshot.
3. Active non-archived project with a next exact step.
4. Most recent non-archived project if timestamps exist.
5. First non-archived project.

If no projects exist, show the empty Today state.

## Empty Today state

If there are no projects:

```text
Today

No projects yet.
Import a folder or create your first project to start your command center.

[Import folder]
[Create project]
```

Use existing import/create handlers if they are available to this component.

## Sections

Below the hero, show 2 or 3 simple sections.

### Needs attention

Projects with:

- open blockers
- imported analysis warnings
- partial scan
- no resume snapshot
- missing next exact step

### Ready to continue

Projects with:

- latest resume
- next exact step
- no open blockers

### All projects

Fallback list if the above sections are sparse.

## Project row design

Rows should be Notion-like, not heavy dashboard cards.

Each row:

```text
● Unity Multiplayer Center
  Blocked · Next: Review skipped summary
```

Status dot color is allowed, but the status must also be written as text.

Do not rely on color alone.

## Required actions

Each row is clickable and calls:

```ts
onSelectProject(project.id)
```

The hero CTA also calls `onSelectProject(recommendedProject.id)`.

## CSS classes

Use classes like:

```text
today-view
today-hero
today-summary
today-section
project-row
project-row-title
project-row-meta
```

## Acceptance criteria

- Today is calm and easy to scan.
- User can understand current work status in under 5 seconds.
- The best next project has one obvious CTA.
- Project rows show friendly names.
- No technical scan wall is visible on the Today screen.
- The screen works with zero projects.
- The screen works with one project.
- The screen works with many projects.
