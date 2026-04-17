## 0. 执行约束与完成定义（DoD）

- 范围约束：仅允许修改 Codex 路径相关前端与测试，不改协议层、不改数据模型。
- 引擎约束：所有新增 UI/逻辑必须带 `activeEngine === "codex"` 门控。
- 安全约束：`isSecret=true` 的输入默认掩码；日志禁止输出明文敏感值。
- 回归约束：Claude/OpenCode 路径行为保持不变，相关回归必须通过。

### 统一 DoD（适用于 1.x / 2.x / 3.x 任务）

- [x] 代码改动与任务锚点一致，无跨范围“顺手改”。
- [x] 对应单测/集成测试已新增或更新，且本地可复现通过。
- [x] 手动验收至少覆盖 1 个正向路径 + 1 个异常路径。
- [x] i18n 文案可读、术语一致（Plan mode / User Input Request）。
- [x] 未引入新的 lint/type 错误。
- [x] Codex thinking 流在长任务中持续可见，且与最终回答顺序一致（无闪烁/丢失/倒序）。

## 1. 协作模式幕布可见性（P1）

- [x] 1.1 [P1][Dep:none] 在 Codex 对话幕布增加协作模式显式状态位

  **目标**：即使 `experimentalCollaborationModesEnabled=false`，Codex 引擎下也能感知到协作模式功能存在。

  **改动文件与锚点**：

    - `src/features/collaboration/hooks/useCollaborationModes.ts:L71-127`
      当 `enabled=false` 时，返回值从空数组改为携带 `{ modes: [], featureAvailable: true, featureEnabled: false }` 的
      结构体，使下游区分"功能不存在"与"功能关闭"。
    - `src/features/composer/components/ComposerInput.tsx:L690-729`
      将条件 `collaborationModes.length > 0 && onSelectCollaborationMode` 改为
      `activeEngine === "codex" && onSelectCollaborationMode`；当 `featureEnabled=false` 时渲染 disabled 态 `<select>`
        + 引导提示文案。
    - `src/App.tsx:L3491-3493`
      透传 `featureEnabled` 状态到 `ComposerInput` props。

  **验证**：

    - `npx vitest run --reporter=verbose -- useCollaborationModes` — hook 单测：`enabled=false` 仍返回
      `featureAvailable: true`
    - 手动验证：Codex 引擎 + 开关关闭 → 幕布显示 disabled 态；Claude 引擎 → 不显示任何协作模式 UI
    - `npm run typecheck` 无新增错误

- [x] 1.2 [P1][Dep:1.1] 协作模式开关关闭时改为"可见但不可交互 + 引导提示"

  **目标**：disabled 态 UI 提供"Enable in Settings"引导入口，点击跳转至设置页实验功能区域。

  **改动文件与锚点**：

    - `src/features/composer/components/ComposerInput.tsx:L690-729`
      disabled 态渲染逻辑：`<select disabled>` + `<span className="hint">` + 点击事件调用 settings 跳转。
    - `src/features/app/hooks/useMenuAcceleratorController.ts:L74-78`
      确认开关关闭时快捷键为 `null`，不需要额外修改——仅作回归验证点。
    - 新增或复用现有的 settings 跳转逻辑（搜索现有 `openSettings` / `navigateToSettings` 调用）。

  **验证**：

    - 组件快照测试：开关开/关两种状态的渲染结果
    - 手动验证：点击 disabled 区域 → 跳转到 Settings 页 → 实验开关可见
    - 键盘可访问性：disabled 态元素加 `tabIndex={-1}` 和 `aria-disabled="true"`

- [x] 1.3 [P1][Dep:1.1] 校验模式切换后发送 payload 一致性

  **目标**：切换 Plan/Code 模式后，`send_user_message` 的 `collaborationMode` payload 与 UI 选中值严格一致。

  **改动文件与锚点**：

    - `src/features/collaboration/hooks/useCollaborationModeSelection.ts:L17-48`
      审查 `buildCollaborationModePayload` 逻辑——当前实现正确，此任务以**补测试**为主。
    - `src/features/threads/hooks/useThreadMessaging.ts:L503-517`
      Codex 路径 `collaborationMode` 传递——确认切换后首条消息即带正确 payload。
    - `src/services/tauri.ts:L265-285`
      `invoke("send_user_message", payload)` — 确认 payload shape 匹配 Rust 端 `SendUserMessagePayload`。

  **验证**：

    - `npx vitest run --reporter=verbose -- useCollaborationModeSelection` — payload 构建单测
    - `npx vitest run --reporter=verbose -- useThreadMessaging` — 发送链路集成测试
    - 测试用例覆盖：Plan→Code→Plan 快速切换后发送消息，payload 始终反映最终选中状态

## 2. 用户提问 GUI 闭环（P1）

- [x] 2.1 [P1][Dep:none] 强化 `requestUserInput` 卡片渲染与线程绑定

  **目标**：卡片仅在对应 `thread_id` 下渲染，跨线程严格隔离。

  **改动文件与锚点**：

    - `src/features/app/components/RequestUserInputMessage.tsx:L28-200`
      审查卡片渲染逻辑——当前 `activeRequests[0]` 只展示首个请求，确认线程绑定来源为
      `threadInputRequests[activeThreadId]`。
    - `src/features/messages/components/Messages.tsx:L668-675, L951-960`
      `find()` 取第一个匹配 request 的逻辑——确认 `threadId` 过滤正确，不会跨线程泄露。
    - `src/features/threads/hooks/useThreadsReducer.ts:L1418-1440`
      `addUserInputRequest` reducer — 确认 `(workspace_id, request_id)` 去重 + 按 `threadId` 分桶存储。

  **验证**：

    - `npx vitest run --reporter=verbose -- RequestUserInputMessage` — 卡片渲染测试
    - 线程隔离测试用例：Thread A 收到 request → 切到 Thread B → Thread B 不应看到 Thread A 的 request
    - 空问题列表边界测试：`requestUserInput` payload 中 `questions=[]` → 渲染空态提示 + 用户仍可提交空 answers
    - `npm run typecheck` 无新增错误

- [x] 2.2 [P1][Dep:2.1] 完成 answers 提交回传与成功后队列移除

  **目标**：用户提交答案后，通过 `respond_to_server_request` IPC 回传，成功后从队列移除该请求。

  **改动文件与锚点**：

    - `src/features/threads/hooks/useThreadUserInput.ts:L11-29`
      `respondToUserInputRequest` 函数——确认 payload 格式 `{ answers: Record<string, { answers: string[] }> }`
      与 Rust 端 `RequestUserInputResponse` 匹配。
    - `src/services/tauri.ts:L321-331`
      `invoke("respond_to_server_request", { workspaceId, requestId, result })` — 确认 IPC 契约。
    - `src/features/threads/hooks/useThreadsReducer.ts`
      提交成功后 dispatch `removeUserInputRequest(threadId, requestId)` — 确认 reducer 已实现移除逻辑。
    - `src-tauri/src/codex/mod.rs:L685-706`
      Rust 端 `respond_to_server_request` — 确认支持 local + remote 两种模式。

  **验证**：

    - `npx vitest run --reporter=verbose -- useThreadUserInput` — 提交逻辑单测
    - 测试用例覆盖：提交成功→队列长度减 1；提交失败→队列不变 + 用户可重试
    - 手动验证：Plan 模式下 AI 触发 requestUserInput → 填写 → 提交 → 卡片消失 → AI 继续执行

- [x] 2.3 [P1][Dep:2.1] 增补多请求队列顺序控制

  **目标**：同一线程多个 `requestUserInput` 按 FIFO 顺序逐个展示，未提交前不跳转。

  **改动文件与锚点**：

    - `src/features/app/components/RequestUserInputMessage.tsx:L28-200`
      当前只取 `activeRequests[0]`，行为已是 FIFO；需增补队列深度展示（如 `"1 of 3"`）。
    - `src/features/threads/hooks/useThreadsReducer.ts:L1418-1440`
      确认新 request 追加到数组末尾（FIFO 语义正确）；确认 `removeUserInputRequest` 移除的是数组首项。
    - `src/features/messages/components/Messages.tsx:L668-675`
      确认消息流中队列深度可感知（可选：在卡片区域显示 pending 计数徽章）。

  **验证**：

    - 队列行为测试：连续入队 3 个 request → 只展示 #1 → 提交 #1 → 展示 #2 → 提交 #2 → 展示 #3
    - 确认队列深度指示器（如 `"1 of 3"`）随提交递减
    - 空问题列表入队测试：`questions=[]` 的 request 入队 → 仍占据队列位置 → 可提交空 answers 后出队

- [x] 2.4 [P1][Dep:2.1] 加入 `is_secret` 默认掩码与日志脱敏

  **目标**：`isSecret=true` 的问题使用密码输入控件，日志中脱敏处理。

  **改动文件与锚点**：

    - `src/types.ts:L239-271`
      `RequestUserInputQuestion` 接口新增 `isSecret?: boolean` 字段。
    - `src/features/app/hooks/useAppServerEvents.ts:L117-155`
      事件规范化逻辑新增：`isSecret: Boolean(question.isSecret ?? question.is_secret ?? false)`。
    - `src/features/app/components/RequestUserInputMessage.tsx:L28-200`
      渲染层：当 `question.isSecret === true` 时：
        - 将 `<textarea>` 替换为 `<input type="password" />`
        - 增加眼睛图标切换按钮（`type="password"` ↔ `type="text"`）
        - 提交区域增加 `"This field contains sensitive data"` 提示。
    - 日志/debug 输出：在所有 `console.log` / logger 调用中，对 `isSecret=true` 的 question value 做 `"***"` 替换。

  **验证**：

    - `npx vitest run --reporter=verbose -- RequestUserInputMessage` — 掩码渲染测试
    - `npx vitest run --reporter=verbose -- useAppServerEvents` — `isSecret` 规范化测试
    - 测试用例覆盖：
        - `is_secret=true` → 渲染 `<input type="password">`
        - `is_secret=false` / 缺失 → 渲染 `<textarea>`
        - 眼睛图标点击 → 切换可见性
        - 日志输出中 secret value 为 `"***"`

## 3. 语义对齐与计划可见性（P1）

- [x] 3.1 [P1][Dep:none] 在工具展示层实现 `askuserquestion` → `requestUserInput` 语义映射提示

  **目标**：`askuserquestion` 工具名在展示时统一为"User Input Request"术语，消除协议概念割裂。

  **改动文件与锚点**：

    - `src/features/messages/components/toolBlocks/toolConstants.ts:L61-116`
      在 `TOOL_DISPLAY_NAMES` / `TOOL_DISPLAY_NAMES_FALLBACK` 映射表中新增：
      `"askuserquestion": "User Input Request"` 条目。
    - `src/features/messages/components/toolBlocks/GenericToolBlock.tsx:L66, L72, L202-280`
      确认 `CODICON_MAP` 和 `COLLAPSIBLE_TOOLS` 已有 `askuserquestion` 条目（无需改动）；
      在渲染链路中，当 `activeCollaborationMode !== "plan"` 时追加 hint：
      `"This feature requires Plan mode"`。

  **验证**：

    - `npx vitest run --reporter=verbose -- toolConstants` — 映射表单测
    - `npx vitest run --reporter=verbose -- GenericToolBlock` — 渲染测试
    - 测试用例覆盖：
        - tool name 为 `askuserquestion` → 展示名为 `"User Input Request"`
        - Code 模式下展示 `askuserquestion` → 追加 Plan mode hint
        - Plan 模式下展示 `askuserquestion` → 无额外 hint

- [x] 3.2 [P1][Dep:1.1] 增加 Plan Mode 语义提示（Plan ≠ update_plan）

  **目标**：用户进入/切换到 Plan 模式时，幕布提供清晰语义说明，避免与 `update_plan` checklist 工具混淆；
  同时提示 `requestUserInput`（用户提问）功能仅在 Plan 模式下可用。

  **改动文件与锚点**：

    - `src/features/composer/components/ComposerInput.tsx:L690-729`
      在 Plan 模式选中时，渲染语义提示区域（tooltip 或 inline hint），文案示例：
      `"Plan mode enables interactive questions. It's different from the update_plan checklist tool."`
      提示必须使用用户友好术语，不暴露协议实现细节。
    - `src/features/collaboration/hooks/useCollaborationModes.ts`
      可选：为每个 mode 增加 `description` 字段，供 UI 层消费。

  **验证**：

    - `npx vitest run --reporter=verbose -- ComposerInput` — 语义提示渲染测试
    - 测试用例覆盖：
        - 切换到 Plan 模式 → 提示可见，包含 "interactive questions" 关键词
        - 切换到 Code 模式 → 提示不可见
        - 提示文案不包含 `update_plan`、`requestUserInput` 等协议术语

- [x] 3.3 [P1][Dep:none] 优化 Plan 区域等待态/空态语义文案

  **目标**：Plan 面板空态区分三种语义（见 design.md Decision 7）。

  **改动文件与锚点**：

    - `src/features/plan/components/PlanPanel.tsx:L3-58`
      将现有 `emptyLabel` 二元三元表达式扩展为三态逻辑：
      ```tsx
      // 现状：isProcessing ? "Waiting on a plan..." : "No active plan."
      // 改为：
      if (!isPlanMode) return "Switch to Plan mode to enable planning";
      if (isProcessing) return "Generating plan...";
      return "No plan generated. Send a message to start.";
      ```
      新增 `isPlanMode: boolean` prop。
    - `src/App.tsx:L1490-1502`
      将 `selectedCollaborationMode?.mode === "plan"` 计算结果作为 `isPlanMode` 传递给布局组件。
    - `src/features/layout/components/DesktopLayout.tsx:L166`
      确认 `plan-collapsed` class 下的内容被 `display:none` 隐藏时，交互元素加 `tabIndex={-1}`
      和 `aria-hidden="true"`。

  **验证**：

    - `npx vitest run --reporter=verbose -- PlanPanel` — 三态空态文案单测
    - 测试用例覆盖：
        - Code 模式 + 无 plan → `"Switch to Plan mode to enable planning"`
        - Plan 模式 + processing + 无 plan → `"Generating plan..."`
        - Plan 模式 + idle + 无 plan → `"No plan generated. Send a message to start."`
        - Plan 模式 + 有 plan → 正常渲染 plan 步骤

- [x] 3.4 [P1][Dep:none] 校验 `turn/plan/updated` 多线程隔离与最新覆盖行为

  **目标**：确认 plan 状态按 `threadId` 严格隔离，同线程新计划覆盖旧计划。

  **改动文件与锚点**：

    - `src/features/threads/hooks/useThreadsReducer.ts:L148, L1535-1550`
      `planByThread[threadId]` 数据结构——确认按 threadId 分桶存储。
    - `src/features/app/hooks/useAppServerEvents.ts:L357-368`
      `turn/plan/updated` 事件消费——确认 `threadId` 从事件 payload 正确提取。
    - `src/features/threads/hooks/useThreadTurnEvents.ts:L189-205`
      `normalizePlanUpdate` → `setThreadPlan` ——确认写入目标为 `planByThread[event.threadId]`，
      新计划完整覆盖旧计划（非合并）。

  **验证**：

    - `npx vitest run --reporter=verbose -- useThreadsReducer` — plan 隔离单测
    - 测试用例覆盖：
        - Thread A 收到 plan → Thread B 收到不同 plan → 切换线程 → 各自 plan 独立
        - Thread A 连续收到 2 个 plan → 显示第 2 个（最新覆盖）
        - Thread A plan 存在 → Thread B 无 plan → 切到 B → 显示空态

- [x] 3.5 [P1][Dep:3.4] 完成计划步骤状态归一化和进度摘要一致性校验

  **目标**：所有 step status 归一化为 `pending`/`inProgress`/`completed`，进度摘要 `completed/total` 与实际一致。

  **改动文件与锚点**：

    - `src/features/threads/utils/threadNormalize.ts:L171-213`
      `normalizePlanStepStatus` 已实现 `pending`/`inProgress`/`completed` 三态映射 + 未知值回退 `pending`。
      此任务以**补测试**为主，覆盖边界值。
    - `src/features/plan/components/PlanPanel.tsx`
      确认进度摘要 `completed / total` 计算逻辑与归一化后的 status 一致。

  **验证**：

    - `npx vitest run --reporter=verbose -- threadNormalize` — 归一化逻辑单测
    - 测试用例覆盖：
        - 标准值：`"pending"` / `"in_progress"` / `"completed"` → 正确映射
        - 非法值：`"unknown"` / `""` / `null` / `undefined` → 回退 `"pending"`
        - 进度摘要：3 个 step（1 completed + 2 pending） → 显示 `"1 / 3"`

## 4. 回归与发布门禁（P0）

- [x] 4.1 [P0][Dep:1.*,2.*,3.*] 执行 Codex 路径验收用例

  **验收清单**：

  | # | 场景 | 预期 | 通过 |
    |---|------|------|------|
  | A1 | Codex 引擎 + 开关关闭 | 协作模式区域可见但 disabled + 引导 | [x] |
  | A2 | Codex 引擎 + 开关开启 + Plan/Code 切换 | UI 即时更新 + payload 一致 | [x] |
  | A3 | Plan 模式 → AI 触发 requestUserInput | 卡片渲染 + 可填写 + 可提交 | [x] |
  | A4 | requestUserInput `is_secret=true` | 密码掩码 + 可切换 + 日志脱敏 | [x] |
  | A5 | 多个 requestUserInput 排队 | FIFO 展示 + 深度指示 | [x] |
  | A6 | Plan 面板 Code 模式空态 | 显示 "Switch to Plan mode..." | [x] |
  | A7 | Plan 面板 Plan 模式等待态 | 显示 "Generating plan..." | [x] |
  | A8 | 工具日志 `askuserquestion` 展示 | 显示 "User Input Request" | [x] |
  | A9 | Code 模式下 `askuserquestion` 日志 | 追加 Plan mode hint | [x] |
  | A10 | Plan 模式语义提示 | 切换到 Plan → 提示可见且不含协议术语 | [x] |

  **验证**：执行对应组件/Hook 自动化回归（16 文件 / 128 tests 全通过），清单状态已逐项标记；截图留待 PR 人工补充。

- [x] 4.2 [P0][Dep:1.*,2.*,3.*] 执行跨引擎回归（Claude/OpenCode 不变）

  **验收清单**：

  | # | 场景 | 预期 | 通过 |
    |---|------|------|------|
  | B1 | Claude 引擎正常会话 | 无协作模式 UI，消息收发正常 | [x] |
  | B2 | OpenCode 引擎正常会话 | 无协作模式 UI，消息收发正常 | [x] |
  | B3 | 引擎切换 Claude → Codex → Claude | 功能入口正确显隐，无残留 UI | [x] |
  | B4 | Claude 引擎 tool block 渲染 | 现有工具展示无变化 | [x] |

  **验证**：

    - 自动化验收 + 关键集成测试
    - `npx vitest run --reporter=verbose src/features/messages/components/Messages.test.tsx` — 消息渲染回归
    -
    `npx vitest run --reporter=verbose src/features/composer/components/ComposerInput.collaboration.test.tsx src/features/composer/components/ComposerInput.attachments.test.tsx src/features/composer/components/ComposerEditorHelpers.test.tsx` —
    输入区回归

- [x] 4.3 [P0][Dep:4.1,4.2] 完成质量门禁命令

  **门禁命令**：

  ```bash
  # TypeScript 类型检查
  npm run typecheck

  # 运行相关 vitest 测试
  npx vitest run --reporter=verbose -- \
    useCollaborationModes \
    useCollaborationModeSelection \
    ComposerInput \
    RequestUserInputMessage \
    useAppServerEvents \
    useThreadUserInput \
    useThreadUserInputEvents \
    useThreadTurnEvents \
    useThreadsReducer \
    PlanPanel \
    threadNormalize \
    toolConstants \
    GenericToolBlock \
    Messages

  # 全量测试（可选，确保无意外回归）
  npx vitest run
  ```

  **通过标准**：

    - `npm run typecheck` 零错误（通过）
    - 上述 vitest 相关测试全部通过（通过；采用文件白名单执行以避免关键词匹配触发无关用例）
    - 无新增 `console.log`（通过；`git diff -U0 | grep console.log` 为空）

## 5. 里程碑执行拆分（便于 PR 分批评审）

- [x] M1 协作模式可见性与一致性
    - 包含任务：`1.1` `1.2` `1.3`
    - 里程碑 DoD：Codex 下模式入口稳定可见；关闭态可引导；payload 一致性用例通过。
- [x] M2 用户提问 GUI 闭环
    - 包含任务：`2.1` `2.2` `2.3` `2.4`
    - 里程碑 DoD：提问链路可提交可重试，FIFO 队列可感知，`is_secret` 安全策略生效。
- [x] M3 语义对齐与计划可见性
    - 包含任务：`3.1` `3.2` `3.3` `3.4` `3.5`
    - 里程碑 DoD：`askuserquestion` 语义统一；Plan 三态空态正确；多线程计划隔离与状态归一化通过。
- [x] M4 发布门禁
    - 包含任务：`4.1` `4.2` `4.3`
    - 里程碑 DoD：Codex 验收清单 A1-A10 全通过，跨引擎清单 B1-B4 全通过，typecheck + vitest 通过。

## 6. Plan 入口前置与快览弹层（P1）

- [x] 6.1 [P1][Dep:3.*] 在编辑状态条增加 `Plan` 快捷入口

  **目标**：在“编辑 x / y 文件”行增加可见 `Plan` 按钮，减少用户视线在编辑区与右侧面板间往返。

  **改动文件与锚点（建议）**：

    - 编辑状态条组件（含 `编辑 x / y 文件` 文案的组件）
    - 计划数据消费层（读取 `planByThread[activeThreadId]`）

  **验证**：

    - 编辑态下 `Plan` 按钮稳定可见
    - 非编辑态不强制显示（按产品设计）

- [x] 6.2 [P1][Dep:6.1] `Plan` 按钮点击弹出计划列表（Popover）

  **目标**：点击按钮弹出计划快览，展示 explanation + steps + 进度摘要（`completed/total`）。

  **验证**：

    - 点击按钮 → 弹层打开
    - 弹层显示当前线程计划步骤与状态
    - 无计划时显示与 PlanPanel 一致的空态/等待态语义

- [x] 6.3 [P1][Dep:6.2] 快览与右侧 Plan 面板数据同源同步

  **目标**：弹层与右侧 Plan 面板不出现状态漂移。

  **验证**：

    - `turn/plan/updated` 到达后，弹层和右侧面板同步更新
    - 切换线程后两处内容同时切换到目标线程计划

- [x] 6.4 [P1][Dep:6.2] 弹层提供“打开完整 Plan 面板”动作

  **目标**：快览与详情形成闭环，用户可一键跳转到右侧完整计划面板。

  **验证**：

    - 点击“查看完整计划”后右侧 Plan 面板展开/聚焦
    - 不改变当前线程与编辑上下文

- [x] 6.5 [P1][Dep:6.1,6.2,6.3] 补齐测试与回归

  **建议测试**：

    - 编辑态按钮可见性测试
    - Popover 打开/关闭与内容渲染测试
    - 与 `turn/plan/updated` 同步测试
    - 线程切换一致性测试

## 7. 里程碑追加（提案增量）

- [x] M5 Plan 快览入口
    - 包含任务：`6.1` `6.2` `6.3` `6.4` `6.5`
    - 里程碑 DoD：编辑行可一键打开 Plan 快览，列表与右侧 Plan 面板同源同步，跨线程不串扰，相关测试通过。

## 8. 执行卡片视觉重构（P1）

- [x] 8.1 [P1][Dep:none] 重构 `File changes` 卡片信息层级

  **目标**：将 `File changes` 从“日志平铺”改为“标题 + 状态 + 摘要 + 明细”结构。

  **验证**：

    - 卡片头显示类型与状态点（成功/失败/进行中）
    - 摘要区显示文件变更统计（新增/修改/删除）
    - 明细区支持折叠/展开

- [x] 8.2 [P1][Dep:none] 重构 `运行命令` 卡片可读性

  **目标**：命令头和输出区分离，失败输出可快速定位。

  **验证**：

    - 命令原文展示在头部且支持复制
    - 输出区域按普通日志/错误日志分层
    - 失败状态默认聚焦错误片段

- [x] 8.3 [P1][Dep:none] 重构 `批量编辑文件` 卡片结果汇总

  **目标**：提供批处理汇总（成功/失败/跳过）与文件级明细入口。

  **验证**：

    - 卡片顶部展示批处理总览统计
    - 文件明细可折叠，支持定位到具体文件项
    - 大批量列表滚动性能可接受（手动验收）

- [x] 8.4 [P1][Dep:8.1,8.2,8.3] 统一三类卡片视觉 token 与间距节奏

  **目标**：保持对话幕布内视觉一致性，避免三套样式割裂。

  **验证**：

    - 三类卡片共享统一标题区高度、内边距、状态位位置
    - 对比截图确认同屏视觉节奏一致

- [x] 8.5 [P1][Dep:8.1,8.2,8.3,8.4] 补齐组件测试与截图回归

  **建议测试**：

    - 成功/失败/进行中三态快照
    - 折叠/展开交互测试
    - 批量明细滚动与渲染测试

## 9. 里程碑追加（视觉重构）

- [x] M6 执行卡片视觉重构
    - 包含任务：`8.1` `8.2` `8.3` `8.4` `8.5`
    - 里程碑 DoD：`File changes`、`运行命令`、`批量编辑文件` 三类卡片完成统一视觉骨架与可读性优化，回归测试通过。

## 10. 提案追加：编辑卡片 Diff 快开与 Plan 入口下沉（P1）

- [x] 10.1 [P1][Dep:8.*] 编辑文件条目支持点击打开 Diff（Git tree 视图）

  **目标**：在“批量编辑文件”卡片中点击文件名，直接进入 Git Diff 页面并切换到 tree 视图，定位对应文件 diff。

  **验证**：

    - 点击文件名后触发 `onOpenDiffPath(path)`
    - 打开路径行为为：`setGitDiffListView("tree")` + `onSelectDiff(path)`
    - 自动化测试覆盖点击行为与参数传递

- [x] 10.2 [P1][Dep:6.*] Plan 按钮从卡片头部下沉到条形功能区

  **目标**：将 Plan 快览入口放到编辑卡片下方条形区，减少头部拥挤并贴合用户操作动线。

  **验证**：

    - Plan 按钮位于编辑卡片底部 toolbar
    - Popover 功能保持不变（进度、说明、步骤、打开完整 Plan）
    - 现有 Plan 快览测试全部通过

## 11. 里程碑追加（交互闭环）

- [x] M7 编辑卡片 Diff 快开与 Plan 下沉
    - 包含任务：`10.1` `10.2`
    - 里程碑 DoD：编辑文件一键进入 Git tree diff，Plan 入口位于条形功能区且交互回归通过。

## 12. 提案追加：全局编辑进度条交互补齐（P1）

- [x] 12.1 [P1][Dep:10.1] 全局编辑进度条中的文件项支持点击打开 Diff（Git tree 视图）

  **目标**：在页面底部“编辑 x / y 文件”全局进度条中，列出的文件名支持点击，并与编辑卡片保持一致的 Diff 跳转行为。

  **验证**：

    - 点击文件名触发 `onOpenDiffPath(path)`
    - 打开路径行为为：`setGitDiffListView("tree")` + `onSelectDiff(path)`
    - 支持绝对/相对路径映射，确保可正确定位到目标文件

- [x] 12.2 [P1][Dep:10.2] 全局编辑进度条补充 Plan 信息（含进度 1/2）

  **目标**：全局进度条补齐 Plan 入口与计划进度摘要，避免“只见编辑，不见计划”。

  **验证**：

    - 全局条显示 `Plan` 入口（按钮或下拉项）
    - 全局条显示计划进度摘要（如 `1 / 2`）
    - 进度数据与右侧 Plan 面板同源，同步更新

- [x] 12.3 [P1][Dep:12.2] 修复全局进度条“打开后不能关闭”问题

  **目标**：全局条的展开/收起交互可逆，避免一次展开后锁死为常开状态。

  **验证**：

    - 连续点击可在展开/收起之间切换
    - 点击空白区或 ESC 可关闭展开态（若存在弹层）
    - 切线程/切会话后状态不串扰

## 13. 里程碑追加（全局编辑条闭环）

- [x] M8 全局编辑进度条交互闭环
    - 包含任务：`12.1` `12.2` `12.3`
    - 里程碑 DoD：全局编辑条文件可直达 diff、Plan 信息完整、展开收起交互可逆且无状态串扰。

## 14. 提案追加：批量运行输出纵向排版重构（P1）

- [x] 14.1 [P1][Dep:8.2] 批量运行输出改为纵向阅读流

  **目标**：修复当前输出横向挤压问题，将每条命令输出按“单条记录纵向展开”展示，提升可读性。

  **验证**：

    - 批量运行每个子命令输出按纵向块展示（非横向拼接）
    - 长文本默认换行，不出现“整段横向铺开”导致阅读断裂
    - 子命令间有稳定分隔（间距/分割线），可快速扫读

- [x] 14.2 [P1][Dep:14.1] 文本排版与可读性优化

  **目标**：统一输出区排版节奏，降低视觉噪声，避免“字挤在一行”的观感问题。

  **验证**：

    - 使用等宽字体并设置合适行高（适配中英文混排）
    - 输出区启用合理断词与换行策略（`pre-wrap` 或等效方案）
    - 错误行与普通日志层级清晰（颜色/权重/背景差异）

- [x] 14.3 [P1][Dep:14.1,14.2] 补齐批量运行纵向布局回归测试

  **目标**：确保后续样式调整不回退为横向挤压布局。

  **验证**：

    - 组件测试覆盖：多子命令输出场景为纵向结构
    - 长行与多段输出快照稳定
    - 成功/失败混合状态下可读性断言通过

## 15. 里程碑追加（批量运行可读性）

- [x] M9 批量运行纵向排版
    - 包含任务：`14.1` `14.2` `14.3`
    - 里程碑 DoD：批量运行输出完成纵向阅读流改造，长文本可读，状态层级清晰，回归测试通过。

## 16. 提案修改：Codex 专属全局活动条（P1）

- [x] 16.1 [P1][Dep:none] 全局活动条改为 Codex 专属门控

  **目标**：全局活动条升级仅作用于 Codex 幕布，不影响 OpenCode/Claude 现有全局条表现。

  **验证**：

    - `activeEngine === "codex"` 时展示新活动条
    - OpenCode/Claude 保持当前行为，不引入样式回归
    - 跨引擎切换时无残留状态

- [x] 16.2 [P1][Dep:16.1] 活动条聚合四类状态（Agent/Edit/Plan/Command）

  **目标**：将当前偏“编辑条”的信息升级为统一活动聚合，支持快速感知执行面貌。

  **验证**：

    - 活动条显示四类计数：`Agent`、`Edit`、`Plan`、`Command`
    - 计数与当前 turn/thread 数据同源
    - 处理中状态可感知（如运行点/旋转态）

- [x] 16.3 [P1][Dep:16.2] 活动条展开为分段详情（非仅文件列表）

  **目标**：展开内容按类型分段展示，至少覆盖 agent 状态、编辑文件、计划步骤、命令运行结果摘要。

  **验证**：

    - 展开后可看到多分段内容，不再仅是文件列表
    - 文件项可继续点击直达 diff（tree 视图）
    - 计划分段显示 `completed/total` 与步骤状态

- [x] 16.4 [P1][Dep:16.2,16.3] 收敛交互：废弃过渡版“对半布局 + 显式关闭按钮”

  **目标**：在新活动条完成后，移除当前过渡交互（编辑/Plan 1:1 对半、额外关闭按钮），统一为活动条交互模型。

  **验证**：

    - 底部条不再使用固定对半布局
    - 不再依赖独立关闭按钮，按活动条交互规范收起/展开
    - 现有 ESC/外部点击关闭行为按新模型保持一致性

- [x] 16.5 [P1][Dep:16.1,16.2,16.3,16.4] 补齐 Codex 专属活动条测试与跨引擎回归

  **目标**：确保新活动条仅在 Codex 生效，并保障消息幕布与工具卡片链路不回归。

  **验证**：

    - 组件测试覆盖：四类计数、展开分段、文件 diff 跳转
    - 集成测试覆盖：Codex 显示活动条、Claude/OpenCode 不显示新活动条
    - `typecheck` + 目标测试集通过

## 17. 里程碑追加（Codex 活动条）

- [x] M10 Codex 专属全局活动条
    - 包含任务：`16.1` `16.2` `16.3` `16.4` `16.5`
    - 里程碑 DoD：Codex 幕布具备统一活动聚合条（Agent/Edit/Plan/Command），展开可看分段详情；过渡版对半布局与关闭按钮下线；跨引擎无回归。

## 18. 提案追加：首段语义图标映射 + Thinking 实时可见（P1）

- [x] 18.1 [P1][Dep:none] 首段关键词图标映射改为可配置规则表

  **目标**：将 `PLAN/校验/结果` 等首段识别从局部分支改为可配置映射，支持中英文同义词持续扩展。

  **改动文件与锚点**：

    - `src/features/messages/constants/codexLeadMarkers.ts`
      新增默认规则（`plan/result/verify/summary/risk/decision/next`）与评分匹配算法。
    - `src/features/messages/components/Markdown.tsx`
      接入 `detectCodexLeadMarker`，并暴露 `codexLeadMarkerConfig` 覆盖能力。
    - `src/styles/messages.css`
      新增 tone class，强化不同语义段落的视觉开头。

  **验证**：

    - `PLAN` 命中 `🧭`，`已执行校验` 命中 `✅`，`下一步建议` 命中 `🚀`
    - 未命中规则时不加图标，保持原文渲染
    - `activeEngine !== \"codex\"` 不启用该增强

- [x] 18.2 [P1][Dep:18.1] 提升规则“智能命中”能力并增加误命中防护

  **目标**：关键词识别支持 exact/startsWith/includes 多级评分，避免简单 contains 带来的误判。

  **改动文件与锚点（建议）**：

    - `src/features/messages/constants/codexLeadMarkers.ts`
      增加评分阈值、优先级、最大首段长度限制。
    - `src/features/messages/components/Messages.test.tsx` 或新增 `Markdown` 级测试
      增加“命中/不命中/冲突词”回归样例。

  **验证**：

    - 低置信度文本（如普通叙述句）不触发语义标签
    - 冲突词场景按最高分规则稳定命中
    - 规则扩展无需改解析分支，仅改配置表

- [x] 18.3 [P1][Dep:none] Codex thinking 流增量内容实时可见

  **目标**：在 Codex 幕布中持续展示 reasoning 过程与状态，避免“只见最终答案、不见过程”。

  **改动文件与锚点（建议）**：

    - `src/features/messages/components/Messages.tsx`
      reasoning item 渲染与工作状态条保持同源，支持流式增量更新。
    - `src/features/messages/components/Messages.test.tsx`
      增加 reasoning 增量回放测试（标题/正文/完成态）。

  **验证**：

    - 处理中可看到 thinking 内容持续追加
    - 完成后 thinking 内容不丢失，最终回答顺序正确
    - Codex 以外引擎不引入新 thinking 展示变化

- [x] 18.4 [P1][Dep:18.3] 补齐 reasoning 流稳定性与性能回归

  **目标**：保证高频流式刷新下，幕布不抖动、输入不阻塞、内容不闪烁。

  **改动文件与锚点（建议）**：

    - `src/features/messages/components/Markdown.tsx`
      复用/校准流式节流策略（当前 80ms flush）并校验渲染稳定性。
    - `src/features/messages/components/Messages.test.tsx`
      增加高频更新测试与长文本断言。

  **验证**：

    - 高频 reasoning 更新时输入框仍可交互
    - 长文本更新过程中无明显抖动/闪烁
    - 目标测试集 + `npm run typecheck` 通过

## 19. 里程碑追加（语义增强与思考流）

- [x] M11 Codex 语义增强与思考流可见性
    - 包含任务：`18.1` `18.2` `18.3` `18.4`
    - 里程碑 DoD：Codex 幕布首段语义标签支持可配置扩展（含 `PLAN→🧭`、`校验→✅` 等）；thinking 流实时可见且顺序稳定；跨引擎无回归。

## 20. 提案追加：语言偏好链路 + 左侧竖线视觉减噪（P1）

- [x] 20.1 [P1][Dep:none] 打通 `preferredLanguage` 透传到 Codex `turn/start`

  **目标**：让模型原始 thinking/reasoning 输出尽量与界面语言一致，减少中英混杂。

  **改动文件与锚点**：

    - `src/features/threads/hooks/useThreadMessaging.ts`
      依据 `i18n.language` 注入 `preferredLanguage`（`zh`/`en`）。
    - `src/services/tauri.ts`
      `sendUserMessage` payload 增加可选 `preferredLanguage` 字段。
    - `src-tauri/src/codex/mod.rs`
      `send_user_message` 命令签名与 remote payload 增加 `preferred_language`。
    - `src-tauri/src/shared/codex_core.rs`
      在 `turn/start` 参数中透传并规范化 `preferredLanguage`。
    - `src-tauri/src/bin/code_moss_daemon.rs`
      RPC 入口解析并传递 `preferredLanguage`。

  **验证**：

    - 中文 UI 下请求 payload 发送 `preferredLanguage: "zh"`。
    - 英文 UI 下请求 payload 发送 `preferredLanguage: "en"`。
    - 后端 `turn/start` 请求参数包含 `preferredLanguage`（可选，不破坏旧调用）。

- [x] 20.2 [P1][Dep:20.1] 保留模型原文（移除 thinking 标题本地化与 language instruction 注入） + Codex 样式改为左侧竖线

  **目标**：降低视觉噪声并避免前端改写模型原文，避免“整块包边”造成幕布污染。

  **改动文件与锚点**：

    - `src/features/messages/components/Messages.tsx`
      `reasoning` 标题保持模型原文，不做中文映射。
    - `src-tauri/src/shared/codex_core.rs`
      移除发送链路 `[Language instruction] ...` 注入文本，仅保留 `preferredLanguage` 透传。
    - `src/styles/messages.css`
      `markdown-lead-*` 与 `reasoning-inline-codex` 从整块边框改为左侧竖线强调。

  **验证**：

    - Codex 幕布中语义段落不再使用整块包边，改为左侧竖线样式。
    - thinking 行样式层级收敛，不出现大面积边框干扰正文，标题保持模型原文。
    - 用户消息不再出现 `[Language instruction] ...` 前置文本。
    - 非 Codex 引擎不受该样式策略影响。

## 21. 手动验收记录（2026-02-17）

- [x] 21.1 正向路径：Codex 普通对话链路

  **步骤**：
    - 在 Codex 幕布发送中文消息。
    - 观察用户消息气泡与 reasoning 行展示。

  **预期**：
    - 用户消息中不出现 `[Language instruction] ...` 前置文本。
    - reasoning 标题显示模型原文，不做前端中文改写。

  **结果**：通过。

- [x] 21.2 异常路径：语言偏好未被上游严格遵循

  **步骤**：
    - 在中文界面保持 `preferredLanguage: "zh"` 透传，观察上游返回混合语种场景。

  **预期**：
    - 前端不做兜底翻译，不篡改模型原文。
    - UI 不插入额外语言提示文本，避免污染用户输入展示。

  **结果**：通过。

## 22. 提案追加：Reasoning 正文回填兼容（P1）

- [x] 22.1 [P1][Dep:18.3] 兼容 `reasoning.text` 单体载荷回填正文

  **目标**：
    - 解决 Codex 上游只在 `item.started/item.updated/item.completed` 中携带 `reasoning.text` 时，幕布出现“有标题无正文”的问题。

  **改动文件与锚点**：

    - `src/utils/threadItems.ts`
      在 `buildConversationItem` 与 `buildConversationItemFromThreadItem` 的 `type === "reasoning"` 分支增加兜底：
      当 `item.content` 为空时，回填 `item.text` 到 reasoning `content`。
    - `src/utils/threadItems.test.ts`
      新增用例覆盖 `reasoning.text`-only 载荷，断言转换后 `content` 非空且可用于幕布正文渲染。

  **验证**：

    - `npx vitest run --reporter=verbose src/utils/threadItems.test.ts`
    - 手动回放 `item.completed(type=reasoning,text=...)` 场景时，Codex 幕布可展示思考正文。

- [x] 22.2 [P1][Dep:22.1] 处理 `item/updated` 事件以支持进行中正文实时刷新

  **目标**：
    - 解决“运行中仅显示 Reasoning 标题，正文要等完成后才出现”的时序问题。

  **改动文件与锚点**：

    - `src/features/app/hooks/useAppServerEvents.ts`
      新增 `item/updated` 事件分支并转发 `onItemUpdated`。
    - `src/features/threads/hooks/useThreadItemEvents.ts`
      新增 `onItemUpdated`，将更新项写入线程；同时避免在 update 阶段重复触发 `incrementAgentSegment`。
    - `src/features/threads/hooks/useThreadEventHandlers.ts`
      将 `onItemUpdated` 接入 handlers 聚合。
    - `src/features/app/hooks/useAppServerEvents.test.tsx`
      增补 `item/updated` 路由测试。
    - `src/features/threads/hooks/useThreadItemEvents.test.ts`
      增补“update 不重复累加分段”测试。

  **验证**：

    - `npx vitest run --reporter=verbose src/features/app/hooks/useAppServerEvents.test.tsx src/features/threads/hooks/useThreadItemEvents.test.ts src/utils/threadItems.test.ts`
    - 运行中 reasoning 文本可随 `item/updated` 实时刷新，不再只有标题占位。
