## 1. Frontend Target 与 Catalog

- [x] 1.1 [P0，依赖：无] 输入：`sharedSessionEngines.ts` 五者 union/Set、`initialTarget.ts` sentinel switch、`resolveSharedSessionCreateInitialTarget.ts`、`sharedSessionSummaries.ts` hide 前缀；输出：六者 union + `"pi"` 入 Set、sentinel `__local_pi__` case、创建解析 Pi 分支、`SHARED_HIDE_ENGINE_PREFIXES` + `"pi"`；验证：`sharedSessionEngines.test.ts` 与 target focused Vitest。注：原列的 `Sidebar.tsx:875` 签名经对抗性 review 确认无需变更——Shared 创建 pi 走 `useProviderTargetCatalogOwners`（已含 DEFAULT_PROFILES.pi）+ `resolveSharedSessionCreateInitialTarget`；创建弹窗 pi 行渲染列入手工验收。
- [x] 1.2 [P0，依赖：1.1] 输入：`useProviderTargetCatalogOwners.ts` 的 `DEFAULT_PROFILES.pi` 现状与 `loadProfileCatalog` 五者 `Promise.allSettled`；输出：Pi 分支接入目录加载（local 形态 + Pi 模型发现），失败隔离不拖垮其他五组；验证：`useProviderTargetCatalogOwners.test.tsx` focused Vitest。
- [x] 1.3 [P0，依赖：1.1,1.2] 输入：Shared/Home picker 与 target 恢复路径消费点（`types.ts:89`、`sharedSessionBridge.ts`、`reattachSharedSessionAttempt.ts`、`resolveDefaultCreationExecutionTarget.ts`、`sharedHistoryLoader.ts` 等）；输出：pi 持久化 target 恢复不再静默回落 claude；验证：target store / bridge focused Vitest + 全量 `tsc --noEmit`。

## 2. Rust Shared Engine Contract

- [x] 2.1 [P0，依赖：无] 输入：`shared_sessions.rs` 的 `is_supported_shared_session_engine` / `is_pending_shared_binding_thread_id` / `binding_uses_established_native_thread`；输出：Pi 入白名单、`pi-pending-shared-` 前缀臂、established 终判 Pi 臂（走 `pi:` 剥离）；验证：`shared_sessions` pending/established focused Rust tests。
- [x] 2.2 [P0，依赖：2.1] 输入：`pi_provider_profile.rs` 内嵌 runtime key 逻辑、`shared_session_v2.rs::provider_runtime_key_for_target` 的 `_ => Err`；输出：抽出 `pi_runtime_key(workspace_id, profile_id)`（local=`workspace_id`，named=`{workspace}::pi::{profile}`）并补 Pi 臂，`resolve_pi_provider_launch_profile` 原样复用；验证：provider runtime key focused Rust tests + Native Pi 发送测试复跑。
- [x] 2.3 [P0，依赖：2.1] 输入：`shared_session_v2.rs::context_capabilities` 的 `_ =>` 全 false 臂；输出：Pi 臂 = weak user-channel transcript（同 Kimi/Grok/OpenCode），`strong_context_ack: false`；验证：context capability focused Rust tests（扩 `[Kimi, Grok, OpenCode]` 数组为含 Pi）。
- [x] 2.4 [P0，依赖：2.2,2.3] 输入：`materialize_attempt_binding`（`Kimi | OpenCode` 臂）、发送 dispatch（`Kimi | Grok | OpenCode` 臂）、binding health probe（`Some(_) => "unsupported-engine"`）；输出：三处补 Pi 臂（local sentinel 回退、`pi:` 剥离、`continue_session = had_native_binding && established`、probe 健康映射），`unreachable!` 锚点保持穷尽；验证：`shared_session_v2` materialize/dispatch/receipt/probe focused Rust tests 扩展 Pi 行。
- [x] 2.5 [P0，依赖：2.4，实施中发现] 输入：`shared_event_log/canonical/validator.rs` 两处 engine 枚举、`interrupt_shared_attempt` 的 `unsupported` 兜底臂、`engine/commands.rs::build_provider_engine_dispatch_receipt` 的 local-sentinel 过滤表（对抗性 review 抓到：缺 Pi 臂会导致 Shared Pi local 轮次 receipt 携带 `__local_pi__`/managed，与 durable owner 不匹配，全部轮次 ambiguous 失败且 runtime 已产生 side effect）；输出：durable Attempt schema 枚举扩 `"pi"`、interrupt 补 Pi 臂、receipt 过滤表补 `(EngineType::Pi, PI_LOCAL_PROVIDER_PROFILE_ID)` 臂；验证：`commands_tests::provider_engine_dispatch_receipt_normalizes_pi_local_sentinel`（经真实 builder）+ receipt owner 持久化 focused Rust tests + `cargo check --lib --bins`。

## 3. Runtime Event 与 Terminal

- [x] 3.1 [P0，依赖：2.4] 输入：Pi Native 分发（`engine/commands.rs` Pi 臂）与 coordinator 的 normalize/engine_token（已预埋）；输出：shared Pi dispatch 经 `engine_send_message` 复用 Pi Session 工厂与 `--session-id` 注入，ingress 按 exact owner 结算；验证：engine forwarder/coordinator focused Rust tests 补 Pi 用例。

## 4. 增量验证与归属核对（不 commit）

- [x] 4.1 [P0，依赖：1.*] 运行 `sharedSessionEngines.test.ts`、`useProviderTargetCatalogOwners.test.tsx`、target/bridge focused Vitest、targeted ESLint、`tsc --noEmit`，全绿。
- [x] 4.2 [P0，依赖：2.*,3.*] 运行 `cargo test --manifest-path src-tauri/Cargo.toml --lib shared_session_v2`、`shared_sessions`、`shared_runtime_coordinator`、`engine::pi` focused tests 与 `cargo check --lib --bins`，全绿。
- [x] 4.3 [P0，依赖：4.1,4.2] 运行 `openspec validate extend-shared-session-cli-targets-pi --strict --no-interactive`、`check:runtime-contracts`、符号哨兵 `rg "EngineType::Pi" src-tauri/src/shared_*.rs` 复查全部 match 臂；`git status --short` + `git diff --name-only` 逐文件核对：本变更文件归属清晰，不含他人未提交的 `fix-pi-session-continuity-and-sidebar` 文件。

## 5. Multi-Agent 协作白名单（补齐 Shared 接入后遗漏的独立闸门）

- [x] 5.1 [P0] 输入：`ComposerToggle.tsx` 硬编码五引擎 `SUPPORTED`；输出：`isMultiAgentTargetSupported` 委托 `isSharedSessionSupportedEngine`（含 pi）；验证：`ComposerToggle.support.test.ts`。
- [x] 5.2 [P0] 输入：`validate_agent_target` 五引擎 match；输出：走 `ensure_supported_shared_session_engine`，错误前缀保持 `agent-target-unavailable:`；验证：`validate_agent_target_tests`。
- [x] 5.3 [P1] 输入：`StageTargetPicker.tsx` `LOCAL_PROFILE` 缺 pi；输出：补 `__local_pi__` sentinel；onboarding F8–F10 + 基石校准表回写。

## 6. 切换视角自审

- [x] 6.1 [P0，依赖：4.3] 兼容性自审：六 CLI picker/绑定/发送、五 CLI 既有行为、Native Pi 行为零回归；`_ =>` 兜底臂、`sanitize_shared_session_meta` 路径、Gemini fail-closed 不变。
- [x] 6.2 [P0，依赖：6.1] 边界自审：Pi 未安装 fail closed、pending 占位不双前缀、established 后 `--session-id` 续聊、Model pair 不匹配零副作用；输出 review 结论清单交用户验收。
