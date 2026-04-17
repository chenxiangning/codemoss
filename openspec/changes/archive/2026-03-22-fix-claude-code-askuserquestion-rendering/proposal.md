## Why

当前 Codex 引擎在 `AskUserQuestion` 场景会渲染可交互提问卡片，但 Claude Code 引擎仍以原始 JSON/日志形态展示，用户无法在 UI 内完成回答与提交。该差异已经影响同一产品内跨引擎一致体验，且直接阻断 Claude 提问链路闭环，需要优先补齐。

## 目标与边界

- 目标：让 Claude Code 引擎在收到 `AskUserQuestion` 相关输出时，渲染与现有交互规范一致的提问卡片（问题、选项、补充输入、提交）。
- 边界：仅覆盖 `claude` 引擎链路；`codex`、`opencode`、`gemini` 行为与文案保持不变。
- 边界：仅处理渲染与提交闭环，不扩展新工具协议，不改变其他工具卡片渲染规则。

## 非目标

- 不对 Codex 既有 `requestUserInput` 机制做重构或语义调整。
- 不做跨引擎通用事件总线大改造。
- 不引入新的协作模式策略（如新增 mode 或修改现有阻断策略）。

## What Changes

- 为 Claude 引擎补齐 `AskUserQuestion` 到前端交互提问模型的标准化映射，避免直接展示原始 JSON。
- 在 Claude 对话幕布复用现有提问卡片交互能力：选项选择（沿用当前单选语义）+ 备注输入 + 提交按钮 + 完成态展示。
- 在提问不可交互条件下（例如模式受限）显示明确提示，避免“只显示日志但不可操作”的误导状态。
- 增加仅针对 Claude 链路的回归测试，验证“可渲染、可提交、可完成、不过界”。
- 无 BREAKING 变更。

## 技术方案对比（含取舍）

| 方案 | 描述 | 优点 | 风险/缺点 | 结论 |
| --- | --- | --- | --- | --- |
| A. 在 Claude 工具日志块内直接解析并内联表单 | 保持现有日志卡片结构，在工具块组件做一次性渲染 | 改动快、文件少 | 与现有提问卡片逻辑重复，后续维护分叉，容易再次与 Codex 行为漂移 | 不选 |
| B. 在 Claude 引擎适配层做语义归一，再走现有提问卡片渲染链路 | 将 Claude `AskUserQuestion` 统一映射为内部提问数据结构，由现有 UI 组件消费 | 复用成熟交互与测试资产，语义一致，边界清晰（仅 claude 入口） | 需要补齐适配层字段映射与回归测试 | 选用 |

## Capabilities

### New Capabilities

- 无（本次不新增 capability，避免与既有 user-input 规范产生并行定义）。

### Modified Capabilities

- `codex-chat-canvas-user-input-elicitation`: 在既有 user-input 契约下补充 `claude` 引擎场景（渲染入口放开、工具块降噪、提交闭环与引擎隔离回归）。

## 验收标准

- 当会话引擎为 `claude` 且收到 `AskUserQuestion` 输出时，幕布 MUST 渲染交互提问卡片，而非原始 JSON 文本。
- 用户可在 UI 内完成选项选择与补充输入并提交，提交后卡片状态 MUST 进入完成态且不重复请求。
- 会话引擎为 `codex` / `opencode` / `gemini` 时，现有行为 MUST 保持不变（含文案、流程与测试基线）。
- Claude 链路至少覆盖以下自动化验证：正常提问渲染、空问题列表、不可交互提示、提交成功/失败重试。

## Impact

- Affected systems:
- Chat Canvas（Claude engine path）工具事件适配与提问卡片渲染入口。
- 提问交互状态管理（仅 claude 来源事件接入，不改其他来源）。
- 相关单元/集成测试用例（新增 Claude 专项回归）。
- Affected APIs/Dependencies:
- 不新增外部依赖，不修改公共后端 API；仅在现有前端事件解释层与组件装配层补齐映射。
