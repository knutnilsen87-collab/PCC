# SPEC 08 — Assistant Bar and Microcopy

## Goal

Keep the assistant fixed at the bottom, but make it calmer, more private and clearer.

The assistant should feel like a command surface, not a noisy chatbot widget.

## Assistant bar

Keep existing assistant functionality.

Update visual treatment:

- Fixed at bottom.
- Dark elevated surface.
- Clear top border.
- Input has strong contrast.
- Quick action chips are subtle.
- `Run` button is secondary unless the user has typed something.

## Assistant default message

Use calmer text.

Current idea:

```text
Import a local folder or create an empty project to activate the command surface.
```

Better:

```text
Ask about this project, create a next step, summarize status, or generate a Codex handoff.
```

When no project exists:

```text
Import a folder or create a project to start your command center.
```

## Quick action labels

Use direct verbs:

```text
Create resume snapshot
Summarize project
Find next step
Generate Codex handoff
```

Do not add extra quick actions in this pass.

## AI truth language

When AI creates a suggestion:

Use:

```text
I drafted a resume snapshot. Review it before saving to project memory.
```

Do not use:

```text
Resume snapshot updated.
```

unless it has actually been applied through approval.

## Import language

Change import-heavy language into private workspace language.

Prefer:

```text
Project added
```

over:

```text
Project imported
```

Prefer:

```text
Safe scan complete
```

over:

```text
Technical scan completed
```

Prefer:

```text
Next action
```

over:

```text
What should happen next?
```

## Buttons

Use:

```text
Resume project
Open repo
Create resume snapshot
Review summary
Run deeper scan
Generate Codex handoff
Back to project
```

Avoid vague labels:

```text
Review
Open
Details
Run
```

unless context makes them obvious.

## Acceptance criteria

- Assistant still works as before.
- Copy feels calmer and more personal.
- AI suggestions are clearly labeled as suggestions.
- User can tell what will be saved and what is only drafted.
- No approval safety is removed.
