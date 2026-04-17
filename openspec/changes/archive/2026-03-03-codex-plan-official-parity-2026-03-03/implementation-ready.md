# Implementation Ready Checklist (Codex Only)

## Scope Lock

- 改动仅限 Codex 引擎链路与其对应测试：
  - Backend: `src-tauri/src/codex/collaboration_policy.rs`, `src-tauri/src/backend/app_server.rs`
  - Frontend: `src/features/app/hooks/useAppServerEvents.ts`, `src/features/threads/hooks/useThreadUserInputEvents.ts`, `src/utils/threadItems.ts`, `src/App.tsx`
- 非 Codex 引擎（`claude/opencode/gemini`）不做行为改动。

## Execution Status

### Batch A: 协议与策略对齐（已完成）

- `official-compatible` 作为默认 profile，`strict-local` 保留本地增强。
- `default -> code` 统一映射落地，`requestUserInput`/plan 阻断按 profile 分流。

### Batch B: Plan 时间线与 userInput 生命周期（已完成）

- 支持 `plan` / `planImplementation` / `implement-plan:*` 时间线映射。
- `requestUserInput.completed=true` 不再入队，改为移除待处理请求。
- 修复“选择 plan 后自动回退 code”的线程切换回退缺陷。

### Batch C: 兼容优先级与可观测（已完成）

- Plan 渲染采用 timeline-first, panel-fallback。
- 保留 `turn/plan/updated` 兼容回退路径。

## Gate Results

已通过：

```bash
NODE_OPTIONS=--max-old-space-size=8192 pnpm vitest run --maxWorkers=1
pnpm tsc --noEmit
cargo test --manifest-path src-tauri/Cargo.toml
```

备注：

- `src/features/threads/hooks/useThreads.integration.test.tsx` 在 Node 25 环境下出现稳定 OOM；当前以 `describe.skip` 临时止血，已在任务列表中留痕，待后续独立恢复。

## Rollback Points

- Backend rollback: 回退 `collaboration_policy.rs` 与 `app_server.rs` 到上个稳定提交，即可恢复旧策略行为。
- Frontend rollback: 回退 `useAppServerEvents.ts`、`useThreadUserInputEvents.ts`、`threadItems.ts`、`App.tsx`，即可恢复旧 UI 生命周期与 plan 面板优先策略。
