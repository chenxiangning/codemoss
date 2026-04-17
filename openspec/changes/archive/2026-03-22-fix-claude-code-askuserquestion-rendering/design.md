## Context

当前问题不是协议缺失，而是前端渲染链路在 Claude 引擎上没有闭环：

- 后端已具备 Claude `AskUserQuestion` 能力：
  - `src-tauri/src/engine/claude.rs` 已将 `AskUserQuestion` 转为 `EngineEvent::RequestUserInput`，并支持 `respond_to_user_input` 回传。
  - `src-tauri/src/engine/events.rs` 已将该事件映射为前端消费的 `item/tool/requestUserInput`。
- 前端已有通用提问卡片组件：
  - `src/features/app/components/RequestUserInputMessage.tsx` 可渲染问题、选项、备注与提交。
  - `src/features/threads/hooks/useThreadUserInput.ts` 可提交回答到 `respond_to_server_request`。
- 断点在展示层：
  - `src/features/messages/components/Messages.tsx` 仅在 `activeEngine === "codex"` 时渲染 `RequestUserInputMessage`，Claude 队列即使存在也不会显示。
  - Claude 工具块仍展示 `askuserquestion` 原始输出，形成“有日志、无交互”的体验。

约束：本变更仅处理 `claude` 引擎路径，不改变 `codex/opencode/gemini` 行为契约。

## Goals / Non-Goals

**Goals:**
- 让 Claude 会话在收到 `item/tool/requestUserInput` 时展示可交互提问卡片，并可提交答案。
- 保持 Codex 现有提问链路与文案不回归。
- 避免 Claude 路径出现“原始 JSON + Plan mode 提示”主导体验。

**Non-Goals:**
- 不改后端 AskUserQuestion 协议结构。
- 不做跨引擎统一重构（不引入新的全局事件总线或 capability flag 系统）。
- 不扩展新的协作模式策略。

## Decisions

### Decision 1: 复用现有 `RequestUserInputMessage`，只放开 Claude 渲染入口

- 选项 A（选用）：在 `Messages.tsx` 将提问卡片渲染条件从“仅 codex”扩展为“codex + claude”（仍受 `onUserInputSubmit` 和 thread/workspace 匹配约束）。
- 选项 B：为 Claude 新建一套独立提问弹层（例如复活 `AskUserQuestionDialog` 作为专用 UI）。

取舍理由：
- A 改动最小、复用现有测试资产、与 Codex 交互一致。
- B 会产生第二套提问 UI，长期维护成本高，且容易出现行为漂移。

### Decision 2: 对 Claude 的 `askuserquestion` 工具块做“降噪”，避免与提问卡片冲突

- 选项 A（选用）：当 `activeEngine=claude` 且当前活动线程存在待处理 `requestUserInput` 时，Claude `askuserquestion` 工具块不再作为主交互入口（最少展示摘要或弱化展示），并移除不适用的 “This feature requires Plan mode” 暗示。
- 选项 B：保留现状（工具块原样 + 提问卡片并存）。

取舍理由：
- A 可避免双入口冲突和误导文案。
- B 虽实现简单，但用户会看到矛盾信息（一个可答、一个说受限）。

### Decision 3: 不改后端协议，前端沿用现有 `respond_to_server_request` 提交路径

- 选项 A（选用）：继续通过 `useThreadUserInput` 调 `respondToUserInputRequest`，由后端在 Claude 活跃会话中路由到 `respond_to_user_input`。
- 选项 B：新增 Claude 专用提交 API。

取舍理由：
- A 不新增 API 面，不引入额外兼容负担。
- B 与现有通用请求响应机制重复，收益不足。

## Risks / Trade-offs

- [Risk] Claude 工具块与提问卡片并存导致重复信息与交互歧义  
  → Mitigation：在 `activeEngine=claude` + 当前线程存在 pending `requestUserInput` 时弱化/折叠 `askuserquestion` 工具块，卡片作为唯一交互入口。

- [Risk] 用户在提问未提交时切换到非 Claude 引擎，提交路径可能不符合预期  
  → Mitigation：仅在当前活动线程与请求线程一致时显示可提交态；切换引擎后卡片进入只读提示或隐藏，避免错误提交。

- [Risk] 仅改前端可能掩盖边界事件（空问题、重复 request_id、completed 事件晚到）  
  → Mitigation：补齐针对 Claude 路径的单测与集成测试，覆盖空问题、重复入队、完成出队、失败重试。

## Migration Plan

1. 调整渲染入口（前端）  
   在 `Messages.tsx` 放开 Claude 的 `RequestUserInputMessage` 显示条件，保持线程与工作区过滤逻辑不变。

2. 调整 Claude `askuserquestion` 展示策略（前端）  
   在工具块渲染层对 Claude 的 `askuserquestion` 增加降噪规则，避免与卡片冲突，移除误导性 Plan-mode hint。

3. 测试补齐（前端）  
   新增/更新以下测试：
   - `Messages`：Claude 引擎下存在 `userInputQueue` 时渲染提问卡片；
   - 工具块：Claude `askuserquestion` 在 pending request 场景不再作为主交互入口；
   - 提交链路：提交后生成 `requestUserInputSubmitted` 记录并从队列移除。

4. 验收与回归  
   - 验证 codex/opencode/gemini 不回归；
   - 验证 Claude 场景从“原始 JSON”转为“可交互卡片”。

5. 回滚策略  
   - 前端特性回滚到 “仅 codex 渲染 requestUserInput”；
   - 保留后端既有 AskUserQuestion 能力，不触及存储与协议。

## Open Questions

- 当 `questions` 为空时，Claude 侧是否与 Codex 保持“允许空回答提交”的一致语义？
- 若后续支持 Gemini/OpenCode 的同类事件，是否复用本次 Claude 的渲染策略，还是按引擎独立配置？
