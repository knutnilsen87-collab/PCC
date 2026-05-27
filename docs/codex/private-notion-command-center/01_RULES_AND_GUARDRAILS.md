# SPEC 01 — Rules and Guardrails

## Goal

Protect existing product behavior while improving the UI/UX.

The current product rule is project-first, AI-assisted, with assistant fixed at bottom and critical AI mutations requiring approval. Preserve those rules.

## Do not change

Do not change:

- Domain state shape unless another spec requires it.
- Approval behavior.
- Assistant command behavior.
- Folder import behavior.
- Read-only scan behavior.
- Package manager.
- Workspace structure.
- Test runner.
- Build scripts.
- Public exports from packages.
- Data migration or localStorage key unless absolutely necessary.

## Do not add

Do not add:

- New dependencies.
- Routing libraries.
- State management libraries.
- CSS frameworks.
- Analytics.
- Telemetry.
- Cloud sync.
- Automatic shell execution.
- Automatic writes to imported repos.

## Allowed changes

Allowed:

- Add local UI state in `App.tsx`.
- Add helper functions in `App.tsx` or a small local helper file under `apps/windows/src/`.
- Add small presentational components inside `App.tsx` if that is the current app pattern.
- Update `styles.css`.
- Update user-facing microcopy.
- Add CSS classes.
- Add TypeScript types for UI-only state.
- Add tests for helpers if there is already a test pattern.

## Safety rule

AI-generated content and project analysis must never visually appear as confirmed truth unless the user has approved or saved it.

Use language like:

```text
Suggested
Review before saving
Pending approval
```

Avoid language like:

```text
Updated
Applied
Confirmed
```

unless the existing app state confirms it.

## Visual rule

This makeover must reduce cognitive load.

The UI should not look more impressive by adding more panels. It should feel better by removing competing visual weight.

Prefer:

- Fewer cards.
- Clear section titles.
- More whitespace.
- Stronger contrast.
- One obvious primary action per screen.
- Technical detail behind disclosure.

Avoid:

- Big gradients behind content.
- Too many glowing panels.
- Multiple primary buttons in the same area.
- Repeated status pills.
- Dense dashboard grids.
