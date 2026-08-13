## Why

Native Provider Continuation 弹窗当前把同一个 `deterministic-char-div-4` estimator 的结果描述为
“预计上下文 Token”，但 Claude/Codex 实际采用不同的 projection policy。真实会话已经出现
`30,933 → 0`、`82,786 → 0` 与 Codex `395,875 → 395,875`：前者会生成空 Context Package，
后者把 compaction 之前的全量 rollout 与完整 Tool Output 当成当前上下文继续注入。

## 目标与边界

- Codex native history reader 必须按已持久化的 compaction replacement history 重建有效窗口，
  不得把已淘汰窗口重新导出。
- Context budget 必须约束最终 delivery projection；`thread/inject_items` 是 transport
  capability，不是 unlimited-history capability。
- checkpoint 必须能折叠 oversized atomic Tool Exchange，并保证有 portable source content
  时不会静默生成 `packageEstimatedTokens=0` 的可执行 package。
- 弹窗继续展示 source → package 的估算，但文案必须明确这是“可移植历史 → 续接包”，不能冒充
  Provider 当前 context usage。

## 非目标

- 不引入在线 token-count API，不增加 preview 网络往返。
- 不声称 `chars / 4` 等于 Claude/Codex model tokenizer 的精确结果。
- 不修改 Provider binding、Continuation Family、target identity 或 Canvas control envelope。
- 不修改或迁移来源 vendor history。

## What Changes

- Codex reader 识别 `compacted.payload.replacement_history`，以最后一次有效 compaction snapshot
  替换旧窗口，再追加 snapshot 之后的增量记录。
- 将 projection shape 与 transport capability 解耦：所有 transport 先应用统一 budget，
  structured import 继续保留 typed Tool Call/Result，但必须使用 budgeted package。
- 为 atomic Tool Exchange 增加 deterministic bounded folding，保留 tool identity、arguments
  摘要及 output head/tail/error evidence。
- checkpoint 在单一 oversized Turn 下改为保留 latest Turn 的最小 portable spine；无法形成
  非空 package 时 fail closed，而不是允许 `0 Token` 继续。
- 更新 UI label、Rust/Vitest regression、OpenSpec delta 与 Trellis executable contract。

## 方案取舍

### 方案 A：compaction-aware reader + transport-independent budget（采用）

在 source semantics 与 package compiler 两个 authoritative boundary 修复。它既消除 Codex
全历史膨胀，也让 Claude/Codex 使用同一 package budget，同时保留 structured import 的高保真
transport。

### 方案 B：只在 UI 截断或修正文案（不采用）

只能掩盖数字，实际仍会注入 39 万估算 Token 或创建空 package，无法保证目标会话可用。

### 方案 C：Codex 永久降级为 prompt checkpoint（不采用）

可以强制压缩，但会丢失已经验证的 `thread/inject_items` typed history 能力，并把 transport
问题与 content budget 错误耦合。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `native-provider-continuation`: Native history 的有效窗口、budgeted projection、non-empty
  package 与 Token preview semantics 需要新增强约束。

## Impact

- Backend：`src-tauri/src/native_history/reader.rs`、
  `src-tauri/src/shared_context/compiler.rs`、`src-tauri/src/native_continuation/commands.rs`
  及对应 tests。
- Frontend：`src/features/app/components/ProviderContinuationDialog.tsx`、locale 与 focused tests。
- Contract：`dev-guidelines/backend/native-provider-continuation-contract.md` 与本 change delta。
- IPC 字段与数据库 schema 保持兼容；不新增 runtime dependency。

## 验收标准

- 含 Codex compaction 的 rollout 只导出最后有效 replacement history 与后续增量。
- Claude/Codex destination 都满足同一 package budget；structured import 不再绕过 budget。
- 单一超大 Turn 不再生成 `source > 0 → package = 0`。
- oversized Tool Output 被确定性折叠，同时保留 tool call/result pairing 与诊断证据。
- 弹窗明确显示“可移植历史 Token → 续接包 Token”。
- Focused Rust/Vitest、typecheck、runtime contracts 与 OpenSpec strict validation 通过。
