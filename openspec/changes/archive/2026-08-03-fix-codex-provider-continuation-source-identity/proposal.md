## Why

Codex catalog thread 可以合法使用 raw logical session id（例如 `codex-history-1`），但 Native Provider Continuation backend 目前把所有来源都强制校验为 `<engine>:<nativeSessionId>`。这会让 raw Codex 会话在 prepare 首阶段直接失败，并显示 `source session identity does not match native session identity`。

## 目标与边界

- 保持现有 engine-aware identity 基线：来源必须与明确的 `engine`、`nativeSessionId` 对应，不能从裸 id 猜 Engine。
- Codex source 同时接受 raw logical id 与 canonical `codex:<thread-id>`；两者必须指向同一个 native thread id。
- Claude/Kimi 继续要求 canonical `<engine>:<nativeSessionId>`，不放宽其他 Engine。
- 保留 frontend 传入的 source logical id，用于 continuation lineage、catalog lookup 与来源导航。

## 非目标

- 不改变 Provider binding、Context Package、prepare/create/discard、progress 或 recovery contract。
- 不统一改写所有 Codex catalog/thread id，也不迁移已有 metadata。
- 不修改 continuation Dialog、Claude/Kimi continuation 或 Codex target execution。
- 不新增依赖或新的 identity abstraction。

## What Changes

- 修改 shared backend source-shape validation：Codex 接受 raw/canonical 两种等价表示，其他 Engine 保持 prefix-strict。
- 增加 Rust regression tests，覆盖 raw Codex、canonical Codex、mismatched Codex 与非 Codex strict validation。
- 增加 frontend hook regression，使用真实 catalog 风格的 raw Codex thread id 锁定 request mapping。
- 修正 Trellis Native Provider Continuation executable contract 中过度严格的 Codex identity 描述。

## 方案取舍

### 方案 A：在 backend shared validator 接受 Codex 双表示（采用）

所有 prepare/create/discard caller 复用同一校验点；保留原 logical id，且只对 Codex 放宽为两个可证明等价的形式。改动最小，能同时保护 lineage 与 Provider binding lookup。

### 方案 B：frontend 一律把 raw Codex id 改写为 `codex:<id>`（不采用）

虽然能绕过当前校验，但会改变 continuation materialization 保存的 source logical id，可能使 sidebar 来源导航和 raw catalog row 失配；其他 caller 仍可能传入 raw id。

### 方案 C：删除 `sessionId` 与 `nativeSessionId` 一致性校验（不采用）

会失去 trust-boundary 防护，允许不相关的 logical/native identity 组合进入 history reader，违背现有基线。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `native-provider-continuation`: 明确 source identity validation 必须按 Engine 处理；Codex raw/canonical logical id 均可映射到同一 native thread，其他不匹配仍 fail closed。

## Impact

- Backend：`src-tauri/src/native_continuation/commands.rs`。
- Frontend tests：`src/features/app/hooks/useSidebarMenus.test.tsx`；生产 mapping 保持不变。
- Contract：`dev-guidelines/backend/native-provider-continuation-contract.md` 与本 change 的 delta spec。
- Dependencies：无新增依赖；IPC payload shape 不变。

## 验收标准

- raw Codex source `sessionId=codex-history-1`、`nativeSessionId=codex-history-1` 可通过 prepare 前置校验。
- canonical Codex source `sessionId=codex:codex-history-1`、`nativeSessionId=codex-history-1` 继续通过。
- Codex source 指向不同 native id 时仍返回原 identity mismatch error。
- Claude/Kimi raw source 仍被拒绝，canonical source 保持通过。
- focused Vitest、focused Rust tests、`npm run typecheck`、`npm run check:runtime-contracts` 与 change strict validation 通过。
