# SPEC 06 — Project Surface Redesign

## Goal

Make the project page calmer, more Notion-like, and focused on the next exact action.

The current imported project overview must stop feeling like a technical scan dashboard.

## Main hierarchy

The project page should render in this order:

1. Project page header.
2. Next action section.
3. Context / summary section.
4. Attention section.
5. Important files section.
6. Technical scan details collapsed.
7. Assistant bar remains fixed at bottom.

## Imported project overview

Update `ImportedProjectOverview`.

### Remove visual dominance from imported header

Do not make this the main visual headline:

```text
Project imported: com.unity.multiplayer.center
```

Instead show a quieter context label:

```text
Imported project
```

Main visible title should use friendly display name:

```text
Unity Multiplayer Center
```

Raw technical name may appear in small muted text:

```text
Raw: com.unity.multiplayer.center
```

### Main section: Next action

The primary hero on the project page should be:

```text
Next action
Review the skipped summary, then run a scoped rescan if the missing areas matter.

A resume snapshot turns this import analysis into a clear restart point for your next work session.

[Create resume snapshot]
```

The primary CTA should be clear and unique.

Secondary actions:

```text
Review project summary
Generate Codex handoff
Run deeper scan
```

These must be visually secondary.

### Setup progress

Convert heavy setup boxes into a compact mission strip.

Before:

```text
[Folder imported] [Safe scan completed] [Summary reviewed] ...
```

After:

```text
Import complete → Safe scan complete → Summary pending → Resume pending → Next step confirmed
```

Use small dots/checkmarks.

Do not use five large cards.

### Context / summary

Use a document-like section:

```text
Context
The multiplayer center provides a starting point to create multiplayer games...
```

### Attention

Use a clean list:

```text
Attention
- No test script detected
- Partial scan
- TODO markers present
```

### Important files

Use a clean list:

```text
Important files
main/AndroidManifest.xml
Likely workflow or entrypoint
```

### Technical details

Keep this collapsed by default:

```text
Technical scan details
```

Inside it, include:

- observations
- risks
- files scanned
- files skipped
- frameworks/languages
- skipped reasons

## Generic project surface

For non-imported projects, keep existing functionality but reduce card overload where practical.

The main visible section should still be Resume / Next exact step.

## Acceptance criteria

- The first thing the eye sees is the next action.
- Technical import status is secondary.
- Project name is friendly.
- There are fewer heavy cards on screen.
- The page feels like a private workspace document, not an admin dashboard.
- Existing handlers still work:
  - create resume from analysis
  - rescan
  - assistant quick action
  - approvals
  - session save
  - blockers
  - file import
