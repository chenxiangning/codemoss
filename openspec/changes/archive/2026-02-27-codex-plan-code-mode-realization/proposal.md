## Why

当前 `plan/code` 协作模式存在“可见但不可证实”的工程风险：用户能在 UI 切换模式，但本地后端没有对模式语义进行强约束，导致是否真正生效取决于外部
app-server 行为，无法在本仓库内完成确定性验证与回归保障。

从代码审计看，当前状态是“前端实装 + 后端透传”，而非“后端策略执行”：

- 前端仅在 Codex 引擎显示协作模式选择，且默认偏向 `plan`（`ComposerInput.tsx`, `useCollaborationModes.ts`, `App.tsx`）。
- 前端发送消息时会组装 `collaborationMode` payload（`useCollaborationModeSelection.ts` -> `sendUserMessage`）。
- Tauri 后端只将 `collaborationMode` 写入 `turn/start` 参数并透传（`src-tauri/src/shared/codex_core.rs`）。
- `collaboration_mode_list` 也是直接转发 `collaborationMode/list`（`src-tauri/src/shared/codex_core.rs`）。
- `WorkspaceSession.send_request` 为通用 JSON-RPC 通道，不含 `plan/code` 分支策略（`src-tauri/src/backend/app_server.rs`）。
- 全仓未发现按 `mode == "plan"`/`mode == "code"` 的后端执行分支（Rust 侧检索）。

这意味着：模式开关当前更像“协作意图声明”，不是“本地可证明的执行契约”。本变更的核心价值是把这种意图升级为可验证行为。

## What Changes

- 引入 Codex 协作模式运行时策略层（Runtime Strategy Layer），在本地后端显式计算 `effective_mode`，并对 `plan` 与 `code`
  施加可验证差异。
- 在 Codex 主消息链路建立线程级模式状态（thread-level mode state），确保同一线程跨轮次行为一致，避免模式抖动。
- 在事件分发链路增加 `requestUserInput` 模式控制：
    - `plan`：保持交互提问流程；
    - `code`：后端拦截该事件并发送标准提示事件，避免交互提问路径误入。
- 增加模式生效可观测字段与日志：
    - `selected_mode`（用户选择）
    - `effective_mode`（后端实际生效）
    - `policy_version`
    - `fallback_reason`（降级原因，若有）
- 保持对外部 app-server 的 `collaborationMode` 透传，以兼容上游策略，同时确保本地策略可独立生效与兜底。
- 补齐自动化测试矩阵（后端策略决策 + 事件拦截 + 前端消费），将“模式生效”纳入回归门禁。
- 明确变更作用域仅限 Codex 引擎链路，`claude` / `opencode` / `gemini` 不引入协作模式行为变化。

## 现状基线（后端）

当前后端能力边界（As-Is）：

- 支持 `collaboration_mode_list` 命令入口，但仅作 RPC 转发。
- 支持在 `turn/start` 中携带 `collaborationMode`，但不解释该字段语义。
- 不维护线程级 `effective_mode` 状态，也不在事件链路中执行 mode-aware 拦截。
- 对 `turn/plan/updated` 和 `item/tool/requestUserInput` 的处理依赖外部事件来源，本地仅分发。

因此，本次改动不是“增加一个开关”，而是“补全一个缺失的后端执行层”。

## 目标与边界

- 目标：让 `plan/code` 在本地工程内具备“可执行、可验证、可观测”的真实语义差异。
- 边界：仅覆盖 Codex 引擎路径，不改变 Claude/OpenCode 的现有策略模型。

## 非目标

- 不在本次变更中重构整个 engine 抽象层。
- 不尝试定义所有工具的细粒度策略矩阵，仅先覆盖与协作模式最相关的关键行为（提问交互、策略注入、状态与可观测）。
- 不修改外部 Codex app-server 源码。

## 技术方案对比

- 方案 A：继续纯透传（仅依赖外部 app-server 解释 `collaborationMode`）
    - 优点：改动小。
    - 缺点：行为不可控、不可验证，无法保证在不同环境一致生效。
- 方案 B：本地增加运行时策略层（推荐）
    - 优点：行为可控、可测试、可观测；可在外部策略失效时提供兜底。
    - 缺点：需要新增线程状态管理与事件处理逻辑，复杂度中等。

取舍：采用方案 B，以本地确定性策略保证模式语义成立，同时保留向外部 app-server 透传以兼容其原生能力。

## Capabilities

### New Capabilities

- `codex-collaboration-mode-runtime-enforcement`: 在 Codex 本地后端建立协作模式运行时策略与线程级约束，使模式差异可验证。

### Modified Capabilities

- `codex-chat-canvas-collaboration-mode`: 从“模式切换一致性”扩展为“模式切换 + 运行时生效保证”。
- `codex-chat-canvas-user-input-elicitation`: 增加按协作模式处理 `requestUserInput` 的行为约束。

## 验收标准

- 在同一环境下，`plan` 与 `code` 两种模式触发的 turn payload 至少在策略字段上有确定差异，且可在日志中观测。
- `code` 模式下收到 `item/tool/requestUserInput` 时，不进入交互卡片流程，并给出明确的模式提示事件。
- `plan` 模式下 `requestUserInput` 流程保持可用，不影响现有提问回传协议。
- 新增的协作模式相关测试通过（后端单测 + 前端事件处理测试），且不引入现有用例回归。
- 非 Codex 引擎（`claude` / `opencode` / `gemini`）相关用例 MUST 与变更前行为一致，不得出现协作模式回归。

## Impact

- Backend (Rust): `src-tauri/src/shared/codex_core.rs`, `src-tauri/src/backend/app_server.rs`,
  `src-tauri/src/codex/mod.rs`（及必要的新策略模块）。
- Frontend (TS/React): `src/features/app/hooks/useAppServerEvents.ts`,
  `src/features/threads/hooks/useThreadTurnEvents.ts`,
  `src/features/messages/components/toolBlocks/GenericToolBlock.tsx`。
- Specs/Tests: 新增 capability spec，补充协作模式生效与拦截场景的测试。
