# Implementation Notes

## 2026-05-02 Baseline

### Large-file watchlist

Command:

```bash
npm run check:large-files:near-threshold
```

Result: 26 warning entries, 0 fail entries.

P0/P1 hotspots in scope:

- `src/services/tauri.ts` - 2263 lines, P0 bridge-runtime-critical.
- `src/app-shell.tsx` - 2426 lines, P0 bridge-runtime-critical.
- `src/features/threads/hooks/useThreads.ts` - 2799 lines, P1 feature-hotpath.
- `src/features/threads/hooks/useThreadsReducer.ts` - 2657 lines, P1 feature-hotpath.
- `src/features/settings/components/SettingsView.tsx` - 2673 lines, P1 feature-hotpath.
- `src/features/git-history/components/git-history-panel/components/GitHistoryPanelImpl.tsx` - 2555 lines, P1 feature-hotpath.
- `src/features/git-history/components/git-history-panel/hooks/useGitHistoryPanelInteractions.tsx` - 2493 lines, P1 feature-hotpath.
- `src/features/composer/components/Composer.tsx` - 2478 lines, P1 feature-hotpath.
- `src-tauri/src/codex/mod.rs` - 2516 lines, P0 bridge-runtime-critical.
- `src-tauri/src/backend/app_server.rs` - 2497 lines, P0 bridge-runtime-critical.
- `src-tauri/src/computer_use/mod.rs` - 2423 lines, P0 bridge-runtime-critical.
- `src-tauri/src/runtime/mod.rs` - 2236 lines, P0 bridge-runtime-critical.
- `src/styles/spec-hub.css`, `src/styles/sidebar.css`, `src/styles/git-history.part1.css`, `src/styles/git-history.part2.css`, `src/styles/messages.part1.css` - P1 style hotspots.

### Allowed write scopes

Bridge extraction:

- `src/services/tauri.ts`
- `src/services/tauri/**`
- `src/services/tauri.test.ts`

Threads extraction:

- `src/features/threads/**`
- `src/utils/threadItems.ts`
- thread-focused tests under the same feature slice

Backend runtime extraction:

- `src-tauri/src/codex/**`
- `src-tauri/src/backend/**`
- `src-tauri/src/runtime/**`
- `src-tauri/src/computer_use/**`
- `src-tauri/src/command_registry.rs`

UI/CSS/test debt:

- `src/features/settings/**`
- `src/features/composer/**`
- `src/features/git-history/**`
- `src/styles/**`
- focused tests for touched components or hooks

Out of scope unless a later task explicitly authorizes it:

- persisted settings schema changes
- Tauri command name changes
- product behavior changes
- Project Memory V2 implementation
- storage format migration

### Compatibility inventory

Frontend compatibility surfaces:

- Existing public exports from `src/services/tauri.ts` remain the compatibility shell.
- Domain modules under `src/services/tauri/**` may own implementation, but existing callers do not need import changes during extraction.
- Payload mapping must preserve camelCase frontend keys and existing backend command names.

Tauri command compatibility surfaces:

- `src-tauri/src/command_registry.rs` remains the registry source.
- `file_read` and `file_write` remain registered through `crate::files::file_read` and `crate::files::file_write`.
- Initial bridge extraction does not touch backend command registration or payload shape.

## Bridge Extraction Order

Initial extraction order:

1. `textFiles` - `file_read` / `file_write` wrappers for global/workspace text configuration files.
2. Workspace management and file tree/read/write domains.
3. Git read/write domains.
4. Threads/Codex runtime domains.
5. Remaining engine/runtime helpers.

Rationale: `textFiles` is the smallest domain with existing payload tests. It proves the legacy re-export pattern without touching feature behavior.

## Threads Extraction Seams

Candidate seams identified for incremental extraction:

1. Tool status classification for `finalizePendingToolStatuses`.
2. Event normalization and item mapping.
3. History hydration mapping.
4. Queue settlement classification.
5. Memory capture boundary.
6. Reducer slices for isolated thread metadata updates.

Initial seam selected: tool status classification. It is a deterministic pure function boundary with focused reducer coverage and no runtime side effects.

## Backend Runtime-Critical Extraction Map

Allowed backend hotspots:

- `src-tauri/src/codex/mod.rs`
- `src-tauri/src/backend/app_server.rs`
- `src-tauri/src/runtime/mod.rs`
- `src-tauri/src/computer_use/mod.rs`

Recommended extraction boundaries:

### Codex

- command wrappers and Tauri command entry points
- session lifecycle and thread operations
- doctor/probe/config helpers
- local/global thread listing and merge helpers
- title, commit message, run metadata, skills, MCP helpers

### Backend app-server

- launch options and wrapper fallback
- probe and doctor-aligned launch diagnostics
- request/response transport
- event extraction and late-event builders
- pending foreground work / resume-pending watch
- plan-mode blocker detection
- tests split by launch, event, and plan enforcement concerns

### Runtime

- runtime key and engine normalization helpers
- pool entry state and lease bookkeeping
- recovery/quarantine gate
- process diagnostics
- commands facade
- session lifecycle helpers

### Computer Use

- status command facade
- activation probe
- host contract diagnostics
- authorization continuity
- plugin contract/platform helpers

Backend extraction rule: command names and payloads remain stable through `src-tauri/src/command_registry.rs`; any command contract change requires a separate OpenSpec change.

Initial backend extraction selected: runtime identity helpers.

- Moved `runtime_key` and `normalize_engine` into `src-tauri/src/runtime/identity.rs`.
- Kept helper visibility internal to the runtime module tree.
- Added focused unit coverage for engine normalization and key construction.
- Did not touch `src-tauri/src/command_registry.rs` because no command entry point moved.

## UI Extraction

Initial UI extraction selected: Settings experimental toggle row.

- Moved `ExperimentalToggleRow` out of `SettingsView.tsx` into `src/features/settings/components/settings-view/components/ExperimentalToggleRow.tsx`.
- Kept props and rendered markup identical.
- Avoided CSS changes in this batch to reduce visual regression risk.

## Second-Pass Extraction Decisions

Threads second seam status: documented deferral.

- The first extracted seam, tool status finalization, passed focused reducer regression and full frontend regression.
- The remaining high-value seams are event normalization, history hydration, and queue settlement.
- They are intentionally deferred to later batches because they cut across live runtime ordering and history replay. This batch already proves the extraction pattern without expanding behavior risk.

Backend second seam status: documented deferral.

- The first backend seam, runtime identity helpers, passed focused runtime tests and full Rust regression.
- Remaining backend candidates such as runtime recovery, app-server launch/probe, and codex command facade carry higher cross-layer risk.
- They should be split in separate batches with narrower Rust filters and command registry review.

## CSS And Test Debt Reduction

CSS split completed.

- Moved the top Spec Hub control/grid/list/status icon section from `src/styles/spec-hub.css` into `src/styles/spec-hub.controls.css`.
- Kept `@import "./spec-hub.controls.css";` at the top of `src/styles/spec-hub.css`, preserving the original cascade order.
- Did not redesign selectors, theme tokens, or visual behavior.

Oversized test split completed.

- Moved reasoning-specific reducer tests from `src/features/threads/hooks/useThreadsReducer.test.ts` into `src/features/threads/hooks/useThreadsReducer.reasoning.test.ts`.
- Kept test assertions unchanged and grouped by existing behavior concern.

## Cross-Layer Review

Reviewed against `dev-guidelines/guides/cross-layer-thinking-guide.md`.

- `textFiles` bridge extraction still calls the same `file_read` / `file_write` Tauri command names.
- Frontend request payload keys remain `scope`, `kind`, `workspaceId`, and `content`; no optional collection semantics changed.
- Backend command registry was not modified for the text file extraction; `file_read` and `file_write` remain registered through the existing files module.
- Runtime helper extraction moved only `runtime_key` and `normalize_engine`; no Tauri command, payload, runtime event, or storage contract changed.
- Settings presentational extraction preserved props, i18n keys, persisted state behavior, and rendered markup.
- No durable new code-level Trellis rule was introduced beyond the OpenSpec contract and implementation notes, so `dev-guidelines/**` was not changed in this batch.

## Large-File Delta

`npm run check:large-files:near-threshold` result changed from 26 warnings to 25 warnings.

Touched hotspot deltas:

- `src/services/tauri.ts`: 2263 -> 2222 lines.
- `src/features/threads/hooks/useThreadsReducer.ts`: 2657 -> 2634 lines.
- `src-tauri/src/runtime/mod.rs`: 2236 -> 2225 lines.
- `src/features/settings/components/SettingsView.tsx`: 2673 -> 2634 lines.
- `src/styles/spec-hub.css`: 2725 -> 2222 lines.
- `src/features/threads/hooks/useThreadsReducer.test.ts`: 2884 -> 2185 lines.

New extracted files remain below governance thresholds:

- `src/services/tauri/textFiles.ts`
- `src/features/threads/hooks/threadReducerToolStatus.ts`
- `src-tauri/src/runtime/identity.rs`
- `src/features/settings/components/settings-view/components/ExperimentalToggleRow.tsx`
- `src/styles/spec-hub.controls.css`
- `src/features/threads/hooks/useThreadsReducer.reasoning.test.ts`
