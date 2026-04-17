## Why

当前 OpenCode 在 CodeMoss 中已经具备核心能力，但主入口仍偏命令面板式，存在“状态不透明、配置分散、学习成本高”的问题。现在进入
UX 收口阶段，目标是仅在 OpenCode 模式内提升可见性与可控性，不扰动 Claude/Codex 主流程。

## What Changes

- 新增 OpenCode 专属状态面板：集中展示 Session / Agent / Model / Provider / MCP / Token/Context 使用状态。
- 新增 OpenCode 专属模型元信息标签：在模型下拉中展示 speed/cost/context 等粗粒度标签。
- 新增 OpenCode 专属 Provider 健康检查入口：连接状态、配置入口、一键测试。
- 新增 OpenCode 专属 MCP 控制区：总开关 + server 级开关 + 权限提示。
- 新增 OpenCode 专属会话发现增强：会话搜索与快捷筛选（最近/收藏）。
- 新增 OpenCode Advanced 区域：调试能力（debug/console/heap）下沉，不进入主操作流。
- 建立模式隔离护栏：所有上述能力仅在 OpenCode 渲染路径和状态域生效。

## Capabilities

### New Capabilities

- `opencode-mode-ux`: OpenCode 模式下的可视化状态中心与控制面板能力。

### Modified Capabilities

- `opencode-engine`: 增补“OpenCode 模式改造隔离”要求，明确禁止影响 Claude/Codex 行为与默认 UI 流程。

## Impact

- 前端：新增 `src/features/opencode/**` 组件与 hooks；在 `App.tsx` 仅为 `activeEngine === "opencode"` 接入。
- 后端：补充 OpenCode 专属状态/健康检查 Tauri commands（如 provider health、mcp toggle、status snapshot）。
- 状态管理：新增 OpenCode 命名空间状态（避免复用通用状态导致串扰）。
- 测试：新增 OpenCode 专属单测与集成测试；增加“非 OpenCode 模式不变”的回归断言。
