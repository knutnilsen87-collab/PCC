# Project Command Center Implementation Status

Date: 2026-05-27

## Completed through phase 9 MVP

- Phase 1: Workspace repo copied from starter kit and made installable with pnpm/Corepack.
- Phase 2: Dark calm desktop app shell implemented in `apps/windows`.
- Phase 3: Canonical Zod schemas implemented for core project, resume, session, blocker, attachment, approval, timeline, and audit objects.
- Phase 4: Local persistence foundation implemented as a browser-local adapter with a state hydration boundary. SQLite/Tauri binding remains the next persistence hardening step.
- Phase 5: Project create/select/archive/restore flow implemented with sidebar and timeline events.
- Phase 6: Resume/session/blocker loop implemented with domain tests.
- Phase 7: Assistant runtime v1 implemented with core tool registry and deterministic command handling.
- Phase 8: Approval flow implemented for AI-generated resume mutations, including audit log creation on apply.
- Phase 9: File import metadata flow implemented through drag/drop, attachment/location creation, timeline events, and duplicate hash checks.

## Local folder import addendum completed

- Added read-only local folder import entry points to the desktop shell.
- Added scanner boundary in `packages/local-fs` with path traversal checks, ignored directory policy, binary skipping, secret deny rules, content redaction, and partial-scan limits.
- Added repo/project analyzer in `packages/repo-analyzer` for project type, stack, package scripts, docs, important files, TODO markers, risks, blockers, and recommended next step.
- Added import orchestration in `packages/project-import`.
- Extended canonical schemas with `ProjectAnalysisSnapshot` and local-folder `Location` metadata.
- Extended domain state with immutable analysis snapshots, read-only locations, duplicate import handling, audit events, timeline events, and rescan snapshot creation.
- Extended assistant registry/context with local project analysis tools and read-only assistant behavior.
- Added main-surface project analysis rendering, warnings/skipped summaries, and rescan UI.
- Added addendum source docs under `docs/addendums/local-folder-import-v1`.

## Imported project overview UX refactor

- Replaced the technical post-import default view with a human-readable Project Setup / Project Overview surface.
- Added a setup checklist that shows progress as completed steps instead of only a raw percentage.
- Added a "What should happen next?" card with one primary CTA and secondary actions.
- Moved scanner internals, skipped reasons, raw file counts, and framework details behind collapsed "Technical scan details".
- Changed imported project sidebar/status presentation to `Imported`, `Needs setup`, `Ready to resume`, or `Blocked`; analysis findings no longer mark the project blocked by default.
- Added assistant quick action chips for imported projects.

## Verification

- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm build`
- Browser verification on `http://127.0.0.1:5187` and clean-state import UI check on `http://127.0.0.1:5188`
- Imported overview presentation tests in `apps/windows/src/importOverview.test.ts`

## Known limitations

- Local persistence is currently browser-local storage, not native SQLite.
- Local folder import uses the browser File System Access API when available; the same scanner/import boundaries are ready for a Tauri folder-picker adapter.
- Browser privacy does not expose the true absolute folder path, so browser imports store a scoped display path like `[selected-folder]/name`; Tauri can replace that with the real user-selected path.
- File ingestion records copied-local metadata and duplicate checks, but native filesystem copy requires the Tauri file bridge.
- Lint scripts are placeholders from the starter kit and should be replaced with ESLint before release hardening.
- Backend sync, mobile PWA, search, exports, and advanced modules start after this phase-9 MVP.
