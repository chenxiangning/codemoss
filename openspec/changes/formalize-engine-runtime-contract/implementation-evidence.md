# Implementation Evidence

## Scope

本文件记录 `formalize-engine-runtime-contract` 的实现证据。实现范围限定为 non-UI core：

- 不修改 UI surface。
- 不修改 runtime reducer 行为。
- 不引入 runtime register / override。
- 只补 contract evidence、adapter parity test、OpenSpec 追踪证据。

## Contract Inventory

### Canonical Types

`src/features/threads/contracts/conversationCurtainContracts.ts` 是当前 frontend runtime contract 真相源。

| Type | Canonical Fields | Evidence |
|---|---|---|
| `ConversationEngine` | `codex` / `claude` / `gemini` / `opencode` | 静态 union |
| `NormalizedThreadEvent` | `engine`, `workspaceId`, `threadId`, `eventId`, `itemKind`, `timestampMs`, `item`, `operation`, `sourceMethod`, optional `delta`, `rawItem`, `rawUsage`, `turnId` | `appendEvent` 与 adapter tests 使用 |
| `NormalizedHistorySnapshot` | `engine`, `workspaceId`, `threadId`, `items`, `plan`, `userInputQueue`, `meta`, `fallbackWarnings` | all history loaders normalize through `normalizeHistorySnapshot` |
| `RealtimeAdapter` | `engine`, `mapEvent(input): NormalizedThreadEvent | null` | 4 个 engine adapter 实现 |
| `HistoryLoader` | `engine`, `load(threadId): Promise<NormalizedHistorySnapshot>` | 4 个 engine loader + shared-session loader 实现 |

### Adapter Registry

`src/features/threads/adapters/realtimeAdapterRegistry.ts` 使用：

```ts
const ADAPTERS: Record<ConversationEngine, RealtimeAdapter>
```

结论：registry 是 static exhaustive mapping。新增 `ConversationEngine` variant 时，未补 adapter 会触发 TypeScript 编译失败。

### Realtime Adapter Behavior

| Engine | Adapter | Behavior |
|---|---|---|
| `codex` | `codexRealtimeAdapter` | shared mapper, `agentMessageSnapshotMode: "snapshot"` |
| `claude` | `claudeRealtimeAdapter` | shared mapper, accepts text delta alias |
| `gemini` | `geminiRealtimeAdapter` | shared mapper, accepts text delta alias |
| `opencode` | `opencodeRealtimeAdapter` | shared mapper, accepts text delta alias |

Accepted canonical normalized methods covered by parity tests:

- `item/agentMessage/delta` -> `message + appendAgentMessageDelta`
- `item/completed` with `agentMessage` -> `message + completeAgentMessage`
- `item/reasoning/textDelta` -> `reasoning + appendReasoningContentDelta`
- `item/commandExecution/outputDelta` -> `tool + appendToolOutputDelta`

Unknown engine-private methods return `null` for all four adapters.

### Legacy Alias Inventory

Compatibility inputs are documented by `REALTIME_CONTRACT_MATRIX` and `LEGACY_REALTIME_ALIAS_FIXTURES`.

| Alias | Canonical Operation | Engines / Notes |
|---|---|---|
| `text:delta` | `appendAgentMessageDelta` | accepted by Claude/Gemini/OpenCode text alias mode |
| `text/delta` | `appendAgentMessageDelta` | accepted by Claude/Gemini/OpenCode text alias mode |
| `item/reasoning/delta` | `appendReasoningContentDelta` | shared reasoning compatibility input |
| `response.reasoning_text.delta` | `appendReasoningContentDelta` | Codex compatibility input |
| `response.reasoning_text.done` | `appendReasoningContentDelta` | Codex compatibility input |
| `item/fileChange/outputDelta` | `appendToolOutputDelta` | file change output delta |
| `response.reasoning_summary_text.delta` | `appendReasoningSummaryDelta` | Codex summary compatibility input |
| `response.reasoning_summary_text.done` | `appendReasoningSummaryDelta` | Codex summary compatibility input |
| `response.reasoning_summary.delta` | `appendReasoningSummaryDelta` | Codex summary compatibility input |
| `response.reasoning_summary.done` | `appendReasoningSummaryDelta` | Codex summary compatibility input |
| `response.reasoning_summary_part.added` | `appendReasoningSummaryBoundary` | Codex summary boundary |
| `response.reasoning_summary_part.done` | `appendReasoningSummaryDelta` | Codex summary part completion |

### History Loader Behavior

| Engine | Loader | Fallback / Normalization |
|---|---|---|
| `codex` | `createCodexHistoryLoader` | remote resume first; optional local session fallback; dedupes/merges comparable user/assistant history |
| `claude` | `createClaudeHistoryLoader` | workspacePath required for native load; filters control-plane rows; preserves approval/file-change artifacts |
| `gemini` | `createGeminiHistoryLoader` | workspacePath fallback returns normalized empty snapshot; parser normalizes message/tool/reasoning rows |
| `opencode` | `createOpenCodeHistoryLoader` | remote resume output normalized through shared thread item builders |
| shared session | `createSharedHistoryLoader` | restores persisted items; normalizes legacy unsupported selected engines back to supported shared-session engine |

History/realtime convergence is covered by `realtimeHistoryParity.test.ts` for Codex, Claude, Gemini, and OpenCode.

## Spec To Test Mapping

| Spec Requirement | Evidence |
|---|---|
| Engine Runtime Realtime Event Contract MUST Be Canonical | `realtimeEventContract.test.ts`, `realtimeAdapters.test.ts` |
| Non-NormalizedThreadEvent Realtime Signals Are Out Of This Contract | `realtimeEventContract.test.ts`, `realtimeAdapters.test.ts` heartbeat assertion |
| Engine History Snapshot Contract MUST Be Semantically Equivalent To Replayed Realtime | `realtimeHistoryParity.test.ts`, `historyLoaders.test.ts` |
| Adapter Registry MUST Be Statically Exhaustive Over Every EngineType | `realtimeAdapterRegistry.ts` `Record<ConversationEngine, RealtimeAdapter>` + `npm run typecheck` |
| HistoryLoader Registry MUST Be Statically Exhaustive Over Every EngineType | `historyLoaders.test.ts`, `realtimeHistoryParity.test.ts` |
| Cross-Engine Parity Test Matrix MUST Cover Canonical Event And History Semantics | `realtimeAdapters.test.ts`, `realtimeHistoryParity.test.ts` |
| Legacy Realtime Aliases MUST Be Documented As Compatibility Inputs | `realtimeEventContract.ts`, `realtimeEventContract.test.ts`, this evidence file |
| Engine Runtime Contract MUST Be Validated By CI | targeted tests, OpenSpec strict, heavy-test-noise, large-file sentry |

## Documented Gaps

- Turn lifecycle, token usage, processing heartbeat, runtime lifecycle, and rate-limit notifications remain outside `NormalizedThreadEvent`; they use existing app-server handler paths.
- No runtime `registerAdapter()` / `overrideAdapter()` is introduced.
- Rust event mapping remains referenced evidence from `stabilize-core-runtime-and-realtime-contracts`; this change does not add Rust SHALL clauses.
- Capability matrix, cost budget, policy chain, and domain event schema are intentionally left to follow-up changes.

## Validation Evidence

Validation commands are recorded after execution in this change's task list. Any skipped check must include reason and residual risk.
