# Proposal: OpenCode Chat Stability & Performance Hardening

## 目标与边界

本变更专注修复 OpenCode Chat 的四类核心问题：

- 首轮对话失败（模型不匹配导致 `Model not found`）
- 首轮耗时过长（UI 控制面板重请求与对话并发）
- 当前会话列表不完整（OpenCode session 未并入主线程列表）
- 偶发跳会话（pending->session 重命名在并发事件下的体感跳转）

边界：

- 仅覆盖 `opencode` 聊天链路与相关 UI 状态流；不重写 Codex/Claude 主链路
- 不改 provider 平台能力，不改 OpenCode CLI 协议
- 本次第二阶段优化必须 **OpenCode-only 隔离开关**，默认不改变 Claude/Codex 行为语义

## 现状问题（基于代码与日志）

1. `Model not found: claude-*`：OpenCode 发送路径缺少模型与引擎匹配 gate，错误模型可透传。
2. CLI 7s vs Chat 32s：聊天页常驻控制面板自动刷新会并发触发 `auth list / mcp list / session list / provider catalog`。
3. 当前会话显示不完整：线程列表聚合只显式合并 Claude 会话，未合并 OpenCode session list。
4. 跳会话：pending->session 已有确定性策略，但缺少 turn 级绑定与短期 alias 机制，极端并发有 UI 跳转体感。

## 方案

### 方案 A（推荐）

- 引入 OpenCode model gate（前端 + 后端兜底）
- 控制面板改为懒加载/节流/发送中暂停刷新
- 主线程列表合并 OpenCode session 数据
- 增加 turn 级 pending 绑定与短期 alias 归并，减少跳会话
- 对话链路新增 OpenCode 隔离策略：
  - OpenCode 禁用自动标题后台生成，避免干扰首轮对话
  - OpenCode 会话 ID 提取增强（递归提取）避免 pending->session 丢绑定
  - OpenCode 队列 in-flight 增加 watchdog 兜底，不影响其他引擎

优点：聚焦问题、改动可控、可分批上线。  
缺点：状态流更复杂，需要新增测试覆盖。

## 验收标准

1. OpenCode 线程发送时，不再出现 `claude-*` 模型透传导致的 `Model not found`。
2. 首轮空消息测试中，Chat 与 CLI 时延差显著收敛（同机同网，P50 收敛到 <= 2x）。
3. 线程列表可稳定看到 OpenCode 历史会话（含重启/刷新后）。
4. pending->session 回填不出现“回答落到新 session 且当前线程静默”的体感跳转。
5. 隔离验收：Claude/Codex 现有对话行为不发生语义变化（通过现有相关测试集）。
6. OpenCode 简单问候场景（同机同网）首包可见时间显著下降，不再出现常态 30s+ 空转。

## 影响范围

- Frontend: `useThreadMessaging.ts`, `useOpenCodeControlPanel.ts`, `useThreadActions.ts`, `useThreadTurnEvents.ts`
- Backend: `engine/commands.rs`（model guard + snapshot/cached query strategy）
- Tests: threads/hooks + opencode panel hooks + engine command tests
