# Implementation Evidence

## Scope

本次实施只完成 `engine-capability-matrix` 的 non-UI core：

- 新增 spec-owned fixture：`specs/engine-capability-matrix/fixtures/matrix.json`
- 新增 TS matrix projection：`src/features/engine/engineCapabilityMatrix.ts`
- 新增 Rust test-only matrix projection：`src-tauri/src/engine/capability_matrix.rs`
- 新增三源一致性脚本：`scripts/check-engine-capability-matrix.mjs`
- 接入 `npm run check:engine-capability-matrix` 与 CI typecheck job

未做 UI degradation pilot；`tasks.md` 中 `[UI-DEFER]` 任务保持延期。

## Inventory

### TS EngineFeatures

`src/types.ts` 当前字段：

| Field | Meaning | Matrix Projection |
|---|---|---|
| `streaming` | supports streaming output | `streaming.text`, `streaming.tool-output` |
| `reasoning` | supports visible reasoning surface | `streaming.reasoning` |
| `toolUse` | supports tool use | `tool.use` |
| `imageInput` | supports image input | `image.input` |
| `sessionContinuation` | supports session continuation | `session.continuation` |

### Rust EngineFeatures

`src-tauri/src/engine/mod.rs` 当前字段：

| Field | Matrix Projection |
|---|---|
| `reasoning_effort` | `reasoning.effort` |
| `collaboration_mode` | `collaboration.mode` |
| `image_input` | `image.input` |
| `session_resume` | `session.continuation` |
| `tools_control` | `tool.use` |
| `streaming` | `streaming.text`, `streaming.reasoning`, `streaming.tool-output` |
| `mcp` | `tool.mcp` |

### UI Hardcoded Branch Inventory

Read-only grep confirmed existing `engine === ...` branches in:

- `src/app-shell.tsx`
- `src/services/tauri.ts`
- `src/features/messages/**`
- `src/features/settings/**`
- `src/features/session-activity/**`
- `src/features/context-ledger/**`
- `src/features/shared-session/**`
- `src/features/composer/**`

本次不改这些 UI/render/import surface，只把 future lookup helper 落地。

## Capability Set

第一版只纳入有现有字段或 runtime contract tests 支撑的 9 个 capability：

- `streaming.text`
- `streaming.reasoning`
- `streaming.tool-output`
- `tool.use`
- `tool.mcp`
- `reasoning.effort`
- `collaboration.mode`
- `session.continuation`
- `image.input`

未纳入 `hook.*`、`memory.*`、`subagent.*`、`cost.*`、`compaction.*`，因为当前 change 没有足够三源证据，避免猜测。

## Validation Evidence

- `npm run check:engine-capability-matrix` -> pass.
- `npm exec vitest run src/features/engine/engineCapabilityMatrix.test.ts` -> pass, 1 file / 3 tests.
- `cargo test --manifest-path src-tauri/Cargo.toml engine::capability_matrix` -> pass, 3 tests.
- `npm run typecheck` -> pass.
- `node --test scripts/check-heavy-test-noise.test.mjs scripts/test-batched.test.mjs` -> pass, 15 tests.
- `node --test scripts/check-large-files.test.mjs` -> pass, 6 tests.
- `npm run check:large-files:gate` -> pass, found=0.
- `openspec validate add-engine-capability-matrix-spec --strict --no-interactive` -> pass.

## Residual Risk

- Full `npm run check:heavy-test-noise` was already executed successfully in this same session for A1 after adding realtime parity tests: 479 test files, 0 act warnings, 0 stdout/stderr payload lines. A2 adds only one small TS test and the heavy-test-noise parser gate was rerun.
- CI three-platform evidence remains CI-owned; local run only proves current macOS workspace.
- CI integration was added to the existing Ubuntu `typecheck` job. Separate three-platform matrix job can be added later if release governance demands it, but this implementation avoids expanding workflow cost during UI refactor overlap.
- Rust projection is `#[cfg(test)]`; runtime does not expose a new capability API yet. This is intentional for non-UI/core-first governance.
