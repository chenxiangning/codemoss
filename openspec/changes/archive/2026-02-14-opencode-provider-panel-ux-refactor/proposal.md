## Why

当前 OpenCode 管理面板在 Provider 连接与认证反馈上存在三类体验问题：

1. 连接动作前置了过多 UI 选择（Provider 下拉、凭据检查按钮），与 OpenCode CLI 原生认证流程重复。
2. 认证状态信息可见性不足（已完成认证默认折叠、关键信息缺少视觉层级和关键词强调）。
3. 模型切换与 Provider 状态反馈脱节，用户无法感知“切换中/校验中/完成”过程。

本次变更目标是把“连接入口前端简化、认证过程交给 CLI、状态反馈前端可视化”一次性做完整。

## What Changes

- 移除“连接 Provider”区域的 Provider 下拉选择及相关逻辑，点击连接后仅触发 CLI 原生选择流程。
- 将“已完成认证”区域改为默认展开，并优化 icon、排版、关键词高亮。
- 将中间三组下拉（Agent/Model/Variant）改为 icon-only 标签头，去除文字标题。
- 将“当前 Provider: xxx（连接状态）”改为随 model 选择实时联动，并增加过程文案提示（切换中/校验中/已同步）。
- 移除“检查凭据”按钮，改为页面打开自动触发凭据检查并刷新状态。

## Capabilities

### New Capabilities

- `opencode-provider-panel-ux-refactor`: OpenCode Provider 面板“CLI-first 连接 + 实时状态反馈”能力。

### Modified Capabilities

- `opencode-engine`: 增补 OpenCode Provider 面板交互规范（连接入口、认证可见性、状态联动、自动检查策略）。

## Impact

- 前端 UI：OpenCode 管理面板 Provider 区域、认证状态区域、Agent/Model/Variant 区域。
- 前端状态：模型切换与 Provider 状态文案联动状态机。
- 后端命令：复用现有连接与凭据检查命令，不新增协议。
- 回归重点：仅限 `engine === "opencode"` 路径，Claude/Codex 行为保持不变。
