## 1. Baseline Lock (Code Reality)

- [x] 1.1 [P0] 固化当前实现基线与差距清单（已回填 proposal/design，含具体文件锚点）。
- [x] 1.2 [P0][depends:1.1] 明确仅补 Codex `Plan Mode` / `Default`，不触达 Claude/OpenCode/Gemini 路径。

## 2. User Terminology Parity

- [x] 2.1 [P0] 统一用户可见术语为 `Plan Mode` / `Default`（`src/utils/collaborationModes.ts` + 前端显示链路已对齐）。
- [x] 2.2 [P0][depends:2.1] 保留内部 `plan/code` 映射，用户正文禁出 `Collaboration mode: code`（`codex_core.rs` 注入文案已替换，`Messages.tsx` 做前后兼容清理）。
- [x] 2.3 [P1][depends:2.2] `/code` 兼容别名保留，行为等价 `/default`。

## 3. Codex Slash Commands

- [x] 3.1 [P0] 扩展 slash 解析支持 `/plan`、`/default`、`/mode`、`/code`（`useQueuedSend.ts`）。
- [x] 3.2 [P0][depends:3.1] 支持 `/plan <text>`、`/default <text>` 原子执行（先切模式再发送）。
- [x] 3.3 [P0][depends:3.1] 非 Codex 引擎输入上述命令按普通文本发送。
- [x] 3.4 [P1][depends:3.1] `/mode` 返回结构化结果 `{threadId, uiMode, runtimeMode}`（`useThreadMessaging.ts`）。

## 4. Thread-Scoped Mode Convergence

- [x] 4.1 [P0] 前端从单一 `selectedCollaborationModeId` 升级为线程级状态（`App.tsx` 增加 `collaborationUiModeByThread` / `collaborationRuntimeModeByThread`）。
- [x] 4.2 [P0][depends:4.1] 后端发射 `collaboration/modeResolved`（`src-tauri/src/codex/mod.rs`）。
- [x] 4.3 [P0][depends:4.2] 前端消费 `modeResolved` 作为最终真值（`useAppServerEvents.ts` + `useThreadEventHandlers.ts` + `useThreads.ts`）。
- [x] 4.4 [P1][depends:4.3] fork/resume/thread switch 场景保持继承与隔离一致（线程状态继承逻辑保留，新增 thread map 收敛）。

## 5. Plan Readonly Enforcement

- [x] 5.1 [P0] 发送层落地 Plan 只读硬约束：`effective_mode=plan` 且 enforcement 开启时强制 `sandboxPolicy=readOnly` + `approvalPolicy=on-request`（`src-tauri/src/shared/codex_core.rs`）。
- [x] 5.2 [P0][depends:5.1] 事件层细分 repo-mutating 命令分类阻断（`app_server.rs` 已对 `apply_patch/fileChange` 与 `commandExecution` 的 git repo-mutating 子集发出 `collaboration/modeBlocked`）。
- [x] 5.3 [P0][depends:5.1,5.2] 统一 reason code + suggestion 的标准事件（`collaboration/modeBlocked` 已补 `reasonCode/reason_code` + `suggestion`，并在 Plan 写路径标准化为 `plan_readonly_violation`）。
- [x] 5.4 [P0][depends:5.1,5.2] `effective_mode=code`（UI `Default`）保持现有执行能力（审批/沙箱按 access mode 走原逻辑）。

## 6. User Input Elicitation Alignment

- [x] 6.1 [P0] `requestUserInput` / `askuserquestion` 交互链路保持模式提示语义，不外显 `code` 为用户主术语。
- [x] 6.2 [P1][depends:6.1] 兼容 camel/snake 双命名字段消费（`useAppServerEvents.ts` 兼容 `requestId/request_id`、`threadId/thread_id` 等）。

## 7. Verification & Guardrails

- [x] 7.1 [P0] 前端测试补齐并通过：slash commands、modeResolved、non-codex passthrough、术语清理关键用例。
- [x] 7.2 [P0] 后端测试补齐并通过：`codex_core` 新增执行策略单测（Plan 强制只读 / Default 直通 / enforcement 开关）。
- [x] 7.3 [P0][depends:7.1,7.2] 执行门禁：`pnpm vitest`（目标套件）、`pnpm tsc --noEmit`、`cargo test codex_core` 均通过，已写入 verification。
- [x] 7.4 [P1][depends:7.3] 回滚开关保留：`codex_mode_enforcement_enabled` 可一键回落只读硬约束。
