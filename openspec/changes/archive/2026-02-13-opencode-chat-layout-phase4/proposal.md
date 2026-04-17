## Why

当前 OpenCode 聊天页在信息层级上仍然拥挤：状态条、管理面板、输入区同时争夺主视图，导致“可见但不好用”。现在需要把 OpenCode 聊天场景升级为“主对话优先、配置次级入口、状态可追踪”的布局，以支撑后续长期二开。

## What Changes

- 重设计 OpenCode 聊天布局为“三层结构”：`主对话区`（永远优先）+ `轻量状态条`（常驻）+ `侧边抽屉`（按需展开）。
- 将 Provider / MCP / Sessions / Advanced 统一收敛到抽屉内 Tab，不再在主聊天区内联占位。
- 对 Provider 交互改为“弹出面板 + 搜索 + 分组”，避免原生 select 在大量选项场景下的可用性问题。
- 新增 OpenCode 布局隔离护栏：OpenCode UI 结构变更仅在 `activeEngine === "opencode"` 生效。
- 增加针对“会话切换 + 发送中 + 抽屉开关”的稳定性回归用例，防止出现跨会话回复和卡转圈错位。

## Capabilities

### New Capabilities
- `opencode-chat-layout`: OpenCode 专属聊天布局规范（主对话优先、抽屉式配置、状态层级化）。

### Modified Capabilities
- `opencode-engine`: 补充 OpenCode 布局改造的隔离要求与回归约束，确保不影响 Claude/Codex 主流程。

## Impact

- 前端：`src/features/opencode/**`、`src/features/composer/components/Composer.tsx`（仅 OpenCode 路径接入点）、`src/styles/opencode-panel.css`。
- 后端：无新增跨引擎 API；继续复用 OpenCode 专属 commands（provider health/catalog、mcp toggle、status snapshot）。
- 测试：新增 OpenCode 布局行为测试与隔离回归测试（Claude/Codex 快照与交互不变）。
- 风险：若抽屉与输入框焦点管理不当，可能出现键盘快捷键冲突；本提案要求覆盖 Esc/Enter/Tab 的交互验收。
