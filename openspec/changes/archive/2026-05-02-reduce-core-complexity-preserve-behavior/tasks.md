## 1. Baseline And Scope Control

- [x] 1.1 [P0][depends:none][I: current large-file watchlist, `package.json` scripts, `dev-guidelines/**`][O: baseline note for touched hotspots and validation commands][V: `npm run check:large-files:near-threshold`] Capture the starting large-file warning set and identify P0/P1 hotspots that this change is allowed to touch.
- [x] 1.2 [P0][depends:1.1][I: `src/services/tauri.ts`, `src/features/threads/**`, `src-tauri/src/{codex,backend,runtime,computer_use}/**`][O: explicit write-scope list per batch][V: code review against scope list] Define allowed write scopes for bridge, threads, backend runtime, UI, CSS, and tests so implementation does not drift into feature work.
- [x] 1.3 [P0][depends:1.2][I: current service exports and command registry][O: compatibility inventory for frontend exports and Tauri commands][V: `rg` checks for export names and command registrations] Record the public compatibility surfaces that must remain unchanged.

## 2. Tauri Service Bridge Extraction

- [x] 2.1 [P0][depends:1.3][I: `src/services/tauri.ts`, existing `src/services/tauri/**` modules][O: extraction order for service domains][V: review confirms no product behavior change] Decide the first extraction order among Git, workspace, threads/Codex, runtime, files, and settings domains.
- [x] 2.2 [P0][depends:2.1][I: selected domain exports in `src/services/tauri.ts`][O: domain module implementation with legacy re-exports preserved][V: `npm run typecheck`] Move the selected domain implementation into `src/services/tauri/<domain>.ts` while keeping existing exports from `src/services/tauri.ts`.
- [x] 2.3 [P0][depends:2.2][I: moved service wrappers and payload mapping][O: focused service contract coverage][V: `npm exec vitest run src/services/tauri.test.ts` or equivalent focused service tests] Add or update tests proving payload names, command names, and return mapping remain stable.
- [x] 2.4 [P0][depends:2.3][I: runtime bridge scripts][O: bridge contract still passes][V: `npm run check:runtime-contracts`] Run runtime contract checks after the bridge extraction batch.
- [x] 2.5 [P1][depends:2.4][I: remaining `src/services/tauri.ts` domains][O: repeatable extraction pattern for future domains][V: code review plus large-file delta] Document the pattern in implementation notes or Trellis spec if it becomes reusable.

## 3. Threads Main Path Extraction

- [x] 3.1 [P0][depends:1.3][I: `src/features/threads/hooks/useThreads.ts`, `useThreadsReducer.ts`, `useThreadActions.ts`, `useThreadMessaging.ts`][O: threads extraction seam list][V: review confirms seams are pure or side-effect boundaries] Identify seams for event normalization, history hydration, queue settlement, memory capture boundary, and reducer slices.
- [x] 3.2 [P0][depends:3.1][I: existing thread regression tests][O: focused tests for the first seam before code movement][V: focused Vitest fails or confirms current behavior before extraction] Add or identify focused tests for the first extracted threads seam.
- [x] 3.3 [P0][depends:3.2][I: first threads seam implementation][O: pure adapter/helper extracted from hook or reducer][V: focused Vitest for the extracted seam] Extract the first deterministic threads seam without changing hook public API.
- [x] 3.4 [P0][depends:3.3][I: extracted threads seam][O: full focused thread regression pass][V: `npm exec vitest run src/features/threads` with the smallest reliable include set] Run focused thread tests and fix any behavior drift before continuing.
- [x] 3.5 [P1][depends:3.4][I: remaining thread hotspots][O: second seam extraction or documented deferral][V: focused Vitest plus `npm run typecheck`] Repeat extraction for the next highest-risk seam only if the first seam is stable.

## 4. Backend Runtime-Critical Extraction

- [x] 4.1 [P0][depends:1.3][I: `src-tauri/src/codex/mod.rs`, `src-tauri/src/backend/app_server.rs`, `src-tauri/src/runtime/mod.rs`, `src-tauri/src/computer_use/mod.rs`][O: backend module extraction map][V: review confirms command names and payloads remain unchanged] Define module boundaries for commands, launch/probe, diagnostics, pool/recovery, models, and tests.
- [x] 4.2 [P0][depends:4.1][I: selected backend hotspot][O: mechanical module extraction with re-exported command path or updated registry][V: `cargo test --manifest-path src-tauri/Cargo.toml <focused-filter>`] Extract one backend module boundary without changing runtime behavior.
- [x] 4.3 [P0][depends:4.2][I: `src-tauri/src/command_registry.rs` and extracted commands][O: command registry remains complete][V: `rg -n \"<moved_command_name>\" src-tauri/src/command_registry.rs src-tauri/src`] Verify moved commands remain registered and callable through the same command names.
- [x] 4.4 [P0][depends:4.3][I: backend runtime-critical tests][O: backend focused tests pass][V: `cargo test --manifest-path src-tauri/Cargo.toml codex` or `app_server` or `runtime` focused filter] Run the most relevant Rust focused tests for the extracted backend area.
- [x] 4.5 [P1][depends:4.4][I: remaining backend hotspots][O: next backend extraction or documented deferral][V: focused Rust tests plus large-file delta] Continue only if command compatibility and tests remain stable.

## 5. UI, CSS, And Test Debt Reduction

- [x] 5.1 [P1][depends:1.2][I: `SettingsView.tsx`, `Composer.tsx`, Git History panel files][O: first UI presentational extraction][V: focused Vitest for touched component plus `npm run typecheck`] Extract presentational components or interaction hooks without changing UI behavior.
- [x] 5.2 [P1][depends:5.1][I: touched UI tests][O: focused UI regression evidence][V: component-specific Vitest] Run focused UI tests and fix any drift before moving to another UI surface.
- [x] 5.3 [P1][depends:1.2][I: large CSS files under `src/styles/**`][O: CSS section split preserving import order][V: `npm run check:large-files` and focused UI smoke] Split one CSS hotspot by existing feature section without visual redesign.
- [x] 5.4 [P2][depends:1.1][I: oversized test files near 3000 lines][O: test files grouped by behavior][V: affected Vitest suites pass] Split one oversized test file only after the covered implementation area is stable.

## 6. Cross-Layer And Spec Synchronization

- [x] 6.1 [P0][depends:2.4,3.4,4.4][I: extracted bridge/thread/backend boundaries][O: cross-layer review notes][V: checklist against `dev-guidelines/guides/cross-layer-thinking-guide.md`] Review whether frontend service, Tauri command, runtime event, and backend payload contracts still align.
- [x] 6.2 [P1][depends:6.1][I: reusable patterns discovered during extraction][O: updated Trellis code-level spec if needed][V: spec review] Update `dev-guidelines/**` only when a durable implementation rule emerges from the refactor.
- [x] 6.3 [P1][depends:6.1][I: large-file governance result][O: documented large-file delta][V: `npm run check:large-files:near-threshold`] Record whether warning count decreased, stayed flat, or increased with justification.

## 7. Full Regression Gate

- [x] 7.1 [P0][depends:2-6][I: OpenSpec artifacts][O: strict OpenSpec validation pass][V: `openspec validate reduce-core-complexity-preserve-behavior --strict`] Validate this change strictly.
- [x] 7.2 [P0][depends:7.1][I: frontend source and tests][O: full frontend static and unit regression pass][V: `npm run lint` && `npm run typecheck` && `npm run test`] Run the full frontend regression gate.
- [x] 7.3 [P0][depends:7.1][I: runtime contract and doctor scripts][O: runtime contract and doctor pass][V: `npm run check:runtime-contracts` && `npm run doctor:strict`] Run runtime contract and strict doctor validation.
- [x] 7.4 [P0][depends:7.1][I: Rust backend source and tests][O: full backend regression pass][V: `cargo test --manifest-path src-tauri/Cargo.toml`] Run full Rust backend tests.
- [x] 7.5 [P0][depends:7.2,7.3,7.4][I: large-file policy and touched files][O: large-file governance result][V: `npm run check:large-files:near-threshold`] Confirm touched files do not increase large-file debt without justification.
- [x] 7.6 [P0][depends:7.2,7.3,7.4][I: desktop application manual smoke matrix][O: manual regression evidence][V: recorded smoke notes] Manually verify app launch, workspace selection, Codex chat create/send/resume/interruption, thread history load, settings persistence, file tree/preview, and Git status/diff/history.
- [x] 7.7 [P0][depends:7.1-7.6][I: all validation output][O: verification evidence file][V: `verification.md` exists and references commands run plus results] Create or update `openspec/changes/reduce-core-complexity-preserve-behavior/verification.md` with command output summaries, manual smoke notes, skipped checks, and residual risks.
