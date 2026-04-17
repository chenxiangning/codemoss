## Context

phase3 已引入 OpenCode 状态中心与控制能力，但当前布局仍然让“配置面板”与“消息主链路”同层竞争，用户在聊天时被迫关注大量二级信息。该问题在 OpenCode 场景最明显，且不应扩散到 Claude/Codex。

## Goals / Non-Goals

**Goals:**
- 保证主聊天链路（阅读消息、输入、发送）拥有最高视觉优先级。
- 将复杂配置（Provider/MCP/Sessions/Advanced）收敛为可按需展开的次级层。
- 全程只作用于 OpenCode 模式，保持其他引擎 UI 与行为不变。

**Non-Goals:**
- 不重构全局 Composer 框架。
- 不修改 Claude/Codex 模式下的面板交互。
- 不改 OpenCode CLI 行为或 provider 协议本身。

## Option Comparison

### Option A: 内联折叠块（当前思路微调）
- 做法：继续把 OpenCode 面板放在聊天区上方，仅通过折叠和分组优化。
- 优点：改动小，迁移成本低。
- 缺点：即使折叠，仍占主布局高度；聊天优先级不稳定。

### Option B: 右侧抽屉 + 常驻摘要条（推荐）
- 做法：聊天区只保留状态摘要条；详细配置进入右侧抽屉 Tab。
- 优点：主链路干净，信息分层明确，支持未来扩展（stats/export/share）。
- 缺点：需要处理焦点管理与小屏适配。

**Decision:** 选择 Option B。

## UX Structure

1. 常驻状态摘要条（OpenCode only）
- 显示：Session / Agent / Model / Provider。
- 操作：打开面板、刷新。
- 约束：单行可读，允许截断，不撑高聊天区。

2. 右侧抽屉（按需打开）
- Tab：Provider / MCP / Sessions / Advanced。
- Provider：搜索 + Popular/Other 分组 + connect/test。
- MCP：总开关 + server 级开关。
- Sessions：搜索 + 最近/收藏。
- Advanced：Debug/Console/Heap 等低频能力。

3. 交互优先级
- Esc：先关 Provider 弹窗，再关抽屉。
- Enter：在聊天输入框优先发送；在 provider 搜索框优先选择。
- 抽屉打开时不得阻断消息流与线程切换。

## Isolation Strategy

- 组件隔离：新增/修改仅限 `src/features/opencode/**` 与 OpenCode 条件渲染分支。
- 状态隔离：OpenCode 面板状态使用 `opencode` 命名空间，不写入全局通用状态。
- 事件隔离：OpenCode 抽屉键盘监听在 `activeEngine !== "opencode"` 时不注册。

## Acceptance Criteria

- 聊天主区在 OpenCode 模式下不再被详细配置面板持续占位。
- 抽屉可完整操作 Provider/MCP/Sessions/Advanced，且可通过 Esc 关闭。
- Provider 列表支持搜索和分组展示，长列表可滚动。
- Claude/Codex 模式下不出现 OpenCode 状态条与抽屉。
- 回归通过：typecheck、关键前端用例、OpenCode 会话切换发送链路。
