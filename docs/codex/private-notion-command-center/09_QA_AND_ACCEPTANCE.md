# SPEC 09 — QA and Acceptance

## Goal

Verify the makeover without breaking the app.

## Required commands

Run:

```bash
pnpm typecheck
pnpm test
pnpm build
```

If any command fails, fix only issues caused by this implementation pass.

Do not hide unrelated failures. Report them clearly.

## Manual QA checklist

### Startup

- [ ] App opens on Today view.
- [ ] Today view is not a technical scan dashboard.
- [ ] Today view shows a clear best next move.
- [ ] Empty state works if localStorage is cleared.

### Sidebar

- [ ] Sidebar shows friendly project names.
- [ ] `com.unity.multiplayer.center` appears as `Unity Multiplayer Center`.
- [ ] Active project is visually clear.
- [ ] Sidebar is calmer and more Notion-like.
- [ ] Today navigation item works.

### Project page

- [ ] Project page title uses friendly name.
- [ ] Next action is the main visual focus.
- [ ] Setup progress is compact, not five large cards.
- [ ] Technical scan details are collapsed.
- [ ] Primary CTA is obvious.
- [ ] Secondary actions do not compete.

### Repo view

- [ ] `Open repo` button appears when a project is active.
- [ ] Clicking it shows Repo view.
- [ ] Repo view shows friendly name and raw technical name.
- [ ] Repo view shows path when available.
- [ ] Repo view shows important files.
- [ ] `Back to project` works.
- [ ] `Run deeper scan` calls existing rescan handler only.
- [ ] No shell commands run automatically.

### Assistant

- [ ] Assistant remains fixed at bottom.
- [ ] Quick action chips still work.
- [ ] `Generate Codex handoff` still works.
- [ ] AI suggestions still require approval where they did before.

### Visual quality

- [ ] Sidebar, main background and cards have clear contrast.
- [ ] Text is readable without eye strain.
- [ ] Accent color is not overused.
- [ ] No large gradient/glow panel dominates the page.
- [ ] The UI feels calm and private.
- [ ] The first visual read answers: "What should I do now?"

### Accessibility

- [ ] Keyboard focus is visible.
- [ ] Status is not communicated by color alone.
- [ ] Reduced motion media query exists.
- [ ] Buttons have meaningful labels.
- [ ] Text contrast is acceptable in dark mode.

## Final response format for Codex

After implementing, Codex should respond with:

```text
Implemented specs:
- SPEC 02 Friendly Project Names
- SPEC 03 View Mode
...

Changed files:
- apps/windows/src/App.tsx — reason
- apps/windows/src/styles.css — reason

Checks:
- pnpm typecheck: pass/fail
- pnpm test: pass/fail
- pnpm build: pass/fail

Notes:
- Any unresolved issue
```

## Hard stop conditions

Stop and ask for confirmation if implementation requires:

- Changing package dependencies.
- Changing schema package public types.
- Adding persistent migrations.
- Removing approval behavior.
- Running shell commands other than typecheck/test/build.
- Editing unrelated packages.
