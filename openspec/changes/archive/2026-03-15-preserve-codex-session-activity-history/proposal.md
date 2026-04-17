## Why

当前 `Codex` 会话在实时运行时可以正常展示 `reasoning`、`commandExecution`、`fileChange` 等活动事实，但用户点击历史会话重新打开时，右侧 `session activity` 可能退化为空态。  
这会造成“实时看得到，历史点开丢失”的割裂体验，也破坏跨引擎一致性。

## 目标与边界

- 目标：保证 `Codex` 历史会话重新打开后，不丢失实时期间已经展示过的关键活动事实。
- 目标：恢复链路至少覆盖 `reasoning`、`commandExecution`、`fileChange`，确保右侧 `session activity` 与消息区工具卡片可重建。
- 目标：保持 `Claude` 与 `OpenCode` 现有历史行为不回退。
- 边界：本次不重写 `session activity` UI，不改动右侧面板交互结构。
- 边界：本次不引入新的持久化介质，优先复用已有 Codex 本地 JSONL 会话记录。

## 非目标

- 不重构 Codex 实时流协议。
- 不新增跨工作区历史聚合能力。
- 不为所有自定义工具补齐完整富展示，只修复当前历史恢复缺口。

## What Changes

- 为 `Codex` 增加本地会话历史读取入口，用于在历史恢复阶段读取 JSONL 原始记录。
- 为 `Codex` 历史 loader 增加 fallback 重建链路，把本地 JSONL 中的 `reasoning`、`function_call/function_call_output`、`custom_tool_call(apply_patch)` 还原为现有 `ConversationItem`。
- 在历史恢复阶段将 fallback 结果与 `resumeThread` 快照做合并，优先保留更丰富的结构化活动项。
- 为退化场景补充回归测试：`resumeThread` 只有 message，但历史恢复后仍可看到 reasoning / command / file change。

## 技术方案对比

### 方案 A：只修前端右侧面板映射

- 优点：改动面小。
- 缺点：治标不治本，底层历史事实仍然缺失，消息区与 activity panel 会继续分叉。

### 方案 B：为 Codex 历史恢复补一条本地 JSONL fallback 链路（采纳）

- 优点：直接对齐实时事实源，能同时服务消息区与 activity panel。
- 优点：复用已有本地会话落盘，不需要等待新后端持久化格式。
- 缺点：需要新增一次本地文件读取与协议解析。

结论：采纳方案 B，因为用户问题的本质是“历史事实缺失”，不是“面板渲染错误”。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `conversation-lifecycle-contract`: 补充 Codex 历史恢复必须能从可恢复事实源重建关键活动项的要求。
- `conversation-tool-card-persistence`: 补充 Codex 本地会话历史重建后，`commandExecution` 与 `fileChange` 必须保持与实时语义一致。
- `codex-chat-canvas-workspace-session-activity-panel`: 补充 Codex 历史会话重新打开后，右侧活动面板不得因为稀疏 `resumeThread` 快照而丢失已展示活动。

## Impact

- 前端：`codexHistoryLoader`、历史恢复辅助解析器、线程动作入口与回归测试。
- 后端：新增 `load_codex_session` Tauri command，从本地 Codex sessions 目录读取 JSONL 历史。
- 数据面：复用现有 `CODEX_HOME/sessions` / 工作区 `codex_home` 下的本地会话文件，无破坏性 schema 变更。
- 风险：历史恢复会增加一次本地 IO；需避免把启动注入消息误当成用户正文回放。
