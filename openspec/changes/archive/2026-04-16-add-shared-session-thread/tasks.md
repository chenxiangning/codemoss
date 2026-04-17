## 1. Shared Session 后端存储与命令骨架（P0）

- [x] 1.1 新增 Rust `shared_sessions` 模块骨架（依赖: 无；输入: 现有 `storage.rs`/app path 基础设施；输出: 独立 store/runtime/commands 文件结构；验证: `cargo check --manifest-path src-tauri/Cargo.toml` 通过，且主入口仅保留最小模块挂载）
- [x] 1.2 实现 `meta.json + log.jsonl` 读写与文件锁封装（依赖: 1.1；输入: shared session id、workspace id、turn/event payload；输出: 原子写入、append-only log、Win/mac 等价路径语义；验证: Rust 单测覆盖路径 normalize、锁文件、原子覆盖与 JSONL 追加）
- [x] 1.3 实现 `SharedEngineBinding` 持久化模型与惰性创建（依赖: 1.2；输入: selected engine、现有 binding 状态；输出: `bindingsByEngine`、`lastSyncedTurnSeq`、`lastUsedAt` 更新；验证: Rust 单测覆盖首次创建、重复复用、元数据更新）
- [x] 1.4 新增 `start_shared_session` 与 shared summary 列表接线（依赖: 1.2, 1.3；输入: workspaceId、初始 selectedEngine；输出: 可创建 shared session，`list_threads` 返回 `threadKind=shared` + `selectedEngine`；验证: Tauri 命令测试覆盖创建成功、列表可见、native session 不回退）

## 2. Shared Turn 路由与恢复链路（P0）

- [x] 2.1 实现 `send_shared_session_message` 主链路（依赖: 1.4；输入: sharedSessionId、selected engine、text、options；输出: canonical log 记录 `turnStarted/userMessage` 并路由到目标 engine binding；验证: Rust/TS 契约测试覆盖单 turn 单引擎发送成功）
- [x] 2.2 实现 shared turn 失败/中断生命周期（依赖: 2.1；输入: 引擎失败、用户中断、超时场景；输出: `turnFailed`/等价终态写回 shared log，且不 silent reroute；验证: 契约测试覆盖失败可恢复、无自动换引擎）
- [x] 2.3 实现 `resume_thread` 的 shared 分流与 `createSharedHistoryLoader`（依赖: 1.4, 2.1；输入: shared session meta + log；输出: 还原 `NormalizedHistorySnapshot`，供现有幕布状态使用；验证: TS 测试覆盖重开后 shared 历史连续、来源引擎信息保留）
- [x] 2.4 实现引擎切换前的 delta sync builder（依赖: 1.3, 2.1；输入: canonical log、binding `lastSyncedTurnSeq`；输出: 切回旧引擎前的增量同步上下文；验证: 单测覆盖首次切换、重复切回、无新增 turn 时空增量）

## 3. 前端 Thread Surface 与 Composer 接入（P0）

- [x] 3.1 扩展 `ThreadSummary` / read model，新增 `threadKind` 与 `selectedEngine`（依赖: 1.4；输入: unified thread list payload；输出: 前端显式识别 native/shared 两类 thread；验证: 类型检查通过，受影响 reducer/selectors 单测更新）
- [x] 3.2 迁移依赖 `threadId` 前缀推断引擎的入口逻辑（依赖: 3.1；输入: `selectedAgentSession.ts`、thread 选择与自动激活链路；输出: 优先读取显式 metadata，不再把 shared 误判为 native engine；验证: TS 测试覆盖 thread 切换、pending finalize、shared/native 共存）
- [x] 3.3 为 shared session 新增 session-scoped engine selector（依赖: 3.1；输入: 当前 shared session `selectedEngine`；输出: 仅 shared session 可见的手动 selector，未切换时 sticky 沿用；验证: 组件/交互测试覆盖切换、沿用、切到其他 session 不串值）
- [x] 3.4 在 `useThreads` / `useThreadActions` / composer send bridge 中接入 shared-specific command（依赖: 2.1, 3.3；输入: shared session send action；输出: shared 走专用命令、native 仍走既有命令；验证: 集成测试覆盖 shared send 与 native send 零回归）

## 4. 幕布复用与 Provenance 渲染（P0）

- [x] 4.1 让 shared session 复用现有幕布/reducer 渲染管线，而非新写 renderer（依赖: 2.3, 3.4；输入: shared history snapshot + normalized realtime events；输出: shared `threadId` 可直接进入既有 conversation state；验证: shared 会话 smoke test 证明无需第二套幕布组件）
- [x] 4.2 为 assistant / key activity item 渲染逐条 provenance badge（依赖: 4.1；输入: per-item engine provenance；输出: `Codex / Claude / Gemini / OpenCode` 明确显示；验证: `Messages`/session activity 测试覆盖多引擎交错历史显示）
- [x] 4.3 接入 shared session 在 thread list / topbar tabs / session activity 的 badge 与文案语义（依赖: 3.1, 4.2；输入: `threadKind=shared` + `selectedEngine`；输出: 列表显示 shared 会话身份与当前引擎快照；验证: 受影响 surface 测试覆盖 shared 可见、native 语义不变）

## 5. Win/mac 兼容与工程门禁（P1）

- [x] 5.1 补齐 shared store / binding manager 的 Win/mac 兼容测试样例（依赖: 1.2, 1.3；输入: 路径分隔符、大小写、rename/lock 语义边界；输出: 双平台等价 contract coverage；验证: Rust 单测或等价 contract 测试覆盖关键平台差异点）
- [x] 5.2 执行 large-file governance 门禁并按需同 PR 拆分（依赖: 3.4, 4.3；输入: 实现后的受影响文件；输出: 无新增超阈值文件，或在同 PR 内完成模块化拆分；验证: `npm run check:large-files:near-threshold` 与 `npm run check:large-files:gate` 通过）
- [x] 5.3 运行最小 MVP 验证集（依赖: 2.4, 4.3, 5.1, 5.2；输入: 完整 MVP 实现；输出: 可创建 shared session、先后用两个引擎连续对话、逐条 provenance 可见、重开历史连续、native session 无回退；验证: 目标 TS 测试 + `cargo check --manifest-path src-tauri/Cargo.toml` + `npm run typecheck` 通过）

## 6. RC 稳定性回修（P0）

- [x] 6.1 修复 selector 触发的本地会话副作用（依赖: 2.1, 3.3；输入: shared selector 更新；输出: 切换引擎只更新 shared meta，不即时拉起 native session；验证: shared 手动回归 + `useThreads.engine-source` 相关测试）
- [x] 6.2 修复 pending binding 串线风险（依赖: 2.1, 2.3；输入: pending placeholder + runtime events；输出: rebind 仅允许唯一且新鲜候选，陈旧 binding 被忽略；验证: `sharedSessionBridge` 与 `useAppServerEvents` 新增测试）
- [x] 6.3 修复 shared/native 列表串视图问题（依赖: 3.1, 3.4；输入: shared 持有的 hidden native bindings；输出: shared 内部 binding 不出现在 native thread 列表；验证: `useThreadActions.shared-native-compat` 测试）
- [x] 6.4 修复共享历史用户消息丢失与截断（依赖: 2.3, 4.1；输入: wrapper/fallback user payload + optimistic messages；输出: Claude/shared 历史用户气泡稳定可见，optimistic reconcile 不误删历史；验证: `threadItems` / `Messages` / `useThreadsReducer` 相关测试）
- [x] 6.5 执行大文件治理拆分（依赖: 6.1-6.4；输入: 接近阈值的 messaging hook；输出: 抽离 `threadMessagingHelpers.ts`，保持主 hook 可维护；验证: `check:large-files:gate` 通过）
