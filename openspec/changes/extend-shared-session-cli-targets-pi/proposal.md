# extend-shared-session-cli-targets-pi

## Why

`add-pi-engine`（2026-08-12，`0889e65c8`）把 PI CLI 接入为 first-class Native engine，但提案中明确非目标：**不加入 `SHARED_SESSION_SUPPORTED_ENGINES`**。Shared Session V2 已支持 Claude / Codex / Kimi / Grok / OpenCode 五个执行目标，而 Pi 的 Native runtime、`PiProviderLaunchProfile`（`__local_pi__` sentinel）、模型发现、realtime event 与 `--session-id` 续聊均已就绪，且 `send_message` 签名与 Kimi/Grok/OpenCode 完全同构。用户无法在同一个 Shared Session 中把下一 Turn 切到 Pi，产品能力与底层 runtime 事实不一致。

## 目标与边界

- 将 PI CLI 接入 Shared Session 四级 Target Picker 与 Home 双栏 create picker，成为第六个 supported Shared target。
- Pi 复用 Shared V2 的 attempt-owned durable dispatch、Context Package、Provider-scoped Binding（local `__local_pi__` sentinel）、terminal settlement、interrupt 路由与 immutable provenance；**不**为 Pi 复制第二套 send pipeline。
- Pi 的 Shared 上下文交付沿用 Kimi/Grok/OpenCode 的 weak user-channel transcript 形态（`user_channel_transcript: true`，`strong_context_ack: false`），不宣称 structured import / native clone。
- Shared Pi Turn 绑定 `pi:<nativeSessionId>` 后必须带 `--session-id` 续聊同一 jsonl，与 `shared-session-engine-selection` 的 binding 契约一致。
- 现有五 CLI 与 Native Pi 行为保持不变。

## 非目标

- 不恢复 Gemini CLI 为 Shared target（retirement migration 继续）。
- 不做 `pi --mode rpc` 长连接、mid-turn steering。
- 不做 Pi managed Provider CRUD 物化——Pi 使用原生 `~/.pi` / models.json / auth，Shared Picker 中仅暴露 local 形态。
- 不做 Pi Shared compaction（与 Kimi/Grok/OpenCode 同现状：`shared-compaction-unsupported`）。
- 不触碰 `fix-pi-session-continuity-and-sidebar` 的 Native 续聊链路（正交变更，工作区未提交）。
- 不引入新 IPC command、新依赖、存储 schema 变更。

## What Changes

- Shared supported-engine contract 从五者扩展为 `Claude | Codex | Kimi | Grok | OpenCode | Pi`。
- **Rust**（窄 adapter 五个 match 臂）：
  - `shared_sessions.rs::is_supported_shared_session_engine` + Pi；`is_pending_shared_binding_thread_id` 补 `pi-pending-shared-` 前缀臂；`binding_uses_established_native_thread` 补 Pi 臂（否则 Pi binding 永判 pending、`pi:{uuid}` 无法判 established）。
  - `shared_session_v2.rs::context_capabilities` 补 Pi 臂（weak user-channel transcript，同 Kimi/Grok/OpenCode）。
  - `shared_session_v2.rs::provider_runtime_key_for_target` 补 Pi 臂——从 `pi_provider_profile.rs` 抽出公开 `pi_runtime_key(workspace_id, profile_id)`（local = workspace key，named = `{workspace}::pi::{profile}`）。
  - `materialize_attempt_binding` / 发送 dispatch / binding health probe 补 Pi 臂，dispatch 走 `engine_send_message` 既有 Pi Native 分发（`get_or_create_pi_session_for_runtime` + `resolve_pi_session_id_for_engine_send` 已就绪）。
  - `unreachable!("new Shared engine branch is exhaustively matched")` 锚点保持穷尽。
- **Frontend**（五处五者枚举点 + 白名单源头）：
  - `sharedSessionEngines.ts` 的 `SharedSessionSupportedEngine` union 与 Set + `"pi"`。
  - `initialTarget.ts::localProviderSentinelId`、`resolveSharedSessionCreateInitialTarget.ts`、`Sidebar.tsx:875` 创建弹窗签名、`useProviderTargetCatalogOwners.ts` provider 加载补 Pi 分支（local 形态 + Pi 模型发现结果）。
  - `sharedSessionSummaries.ts` 的 `SHARED_HIDE_ENGINE_PREFIXES` + `"pi"`，防 Native Pi 会话泄漏进 Shared 视图或反之。
  - Pi 的 Reasoning 级沿用 Kimi 同款默认路径（`atomicModelReasoning.ts` 不扩 Pi 档位枚举，与 Kimi 对齐）。
- **Specs**：同步 `shared-session-engine-selection`、`shared-execution-target`、`shared-send-pipeline`、`model-provider-catalog-runtime`、`composer-control-surface` 五个 capability 的 delta。
- **测试**：扩展 `shared_session_v2.rs` 的 context_capabilities / receipt / materialize / probe Rust 测试与 FE 的 shared engine focused Vitest（`sharedSessionEngines`、`targetStore`、`useProviderTargetCatalogOwners`、创建 target 解析）。

## 方案对比与取舍

| 方案 | 做法 | 取舍 |
|---|---|---|
| A. 只放开 FE/Rust 白名单 | 加 Pi 进 Set 与 allowlist | `provider_runtime_key_for_target` / materialize / dispatch / probe 四个 `_ =>` 仍 Err，属于表面支持。拒绝。 |
| B. 为 Pi 复制一套 Shared send pipeline | 复制 Tx1/Binding/ACK/terminal/recovery 状态机 | 形成第六套漂移实现，违反 `shared-session-v2-send-contract` 的 engine-neutral 契约。拒绝。 |
| C. 扩展现有 engine-neutral Shared V2 owner + 窄 adapter | durable attempt、Context Package、receipt、terminal、commit 保持单一 contract；仅 Binding identity、runtime key、capability 与 EngineEvent ingress 做 Pi 映射 | 与 `extend-shared-session-cli-targets` 先例同一路径，改动面最小、可回滚。**采用** |

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `shared-session-engine-selection`: Shared Session 可选择 Pi，且不得静默 fallback；Pi 不可用时 fail closed 并给出可读原因。
- `shared-execution-target`: Pi 的 Provider-scoped Binding（local sentinel）、immutable snapshot 与 owner routing。
- `shared-send-pipeline`: Pi 的 durable provisioning、dispatch receipt、EngineEvent terminal settlement 与 recovery。
- `model-provider-catalog-runtime`: Pi local Provider Profile 与 Model catalog 可被 Atomic Shared/Home picker 按 binding scope 查询。
- `composer-control-surface`: Shared 与 Home 双栏展示并启用六 CLI；Native Session 保持原行为。
- `multi-agent-orchestration`: 协作 host / stage 白名单与 Shared 支持集合同集；PI 可启用协作，Gemini 仍 fail-closed。

## Impact

- Frontend：`src/features/shared-session/**`、`src/features/composer/**`、`src/features/multi-agent/components/{ComposerToggle,StageTargetPicker}.tsx`、`src/features/app/components/Sidebar.tsx` 与 focused Vitest。
- Backend：`src-tauri/src/shared_sessions.rs`、`shared_session_v2.rs`、`agent_orchestration/support.rs`、`engine/pi_provider_profile.rs` 与相关 Rust tests。
- Runtime contract：复用现有 Tauri commands 与 Engine runtime；不新增 IPC command。
- Storage：继续 schema v2 与 `{engine}:{providerProfileId || default}` Binding Key，无迁移。
- Dependencies：无新增依赖。
- 回滚：Pi 未安装时 Shared Picker 中 Pi 显示 not-installed 且不可选；任何一步验证失败可整体 revert，不影响五 CLI 与 Native Pi。

## 验收标准

- Shared Picker 左栏按产品顺序展示并启用 Claude、Codex、Kimi、Grok、OpenCode、Pi 六 CLI；Pi 未安装时不可选且有可读原因，不产生 Runtime side effect。
- 选择 Pi local Provider 的 Model 后，完整 Target 可持久化、重载并用于下一 Turn；Provider、runtime Model、native session identity 与 Badge 均来自同一 frozen snapshot，无 default CLI/Provider fallback。
- 同一 Pi Shared Binding 连发两轮，磁盘仍是 1 个 jsonl，第二轮 `engine_send_message` 携带 `--session-id`（established 判定生效，`pi-pending-shared-*` 不双前缀）。
- Pi Turn 在 Runtime side effect 前先写 `conversation.turnRequested`，发送后由 exact Attempt owner 收敛 terminal 并 exactly-once 提交 `conversation.turnCommitted`；interrupt/rebuild/probe 只按 durable Attempt/Binding 路由。
- Provider 删除或 Model pair 不匹配时 fail closed，Runtime side effect 为零。
- 现有五 CLI 的 Shared 行为与 Native Pi 行为无变化。
- 受影响增量 Vitest、Rust tests、TypeScript typecheck、runtime contracts 与 `openspec validate --strict` 通过。
