# Proposal: OpenCode Session Concurrency Hardening

## 目标与边界

本变更聚焦一个仍未达生产级的问题：在 OpenCode 场景下，用户并发切线程/并发发消息时，偶发出现“旧线程转圈、回复落到新 session”。

目标：

- 消除由全局 `activeEngine` 导致的跨引擎误路由窗口。
- 将 pending->session 回填从“启发式”升级为“强绑定优先 + 歧义不迁移”。
- 只改 OpenCode 路径，不改变 Claude/Codex 行为语义。

边界：

- 仅覆盖 OpenCode 聊天链路（前端线程绑定与后端路由参数）。
- 不改 provider 协议，不改 UI 交互样式。
- 不做状态管理框架级重构。

## 现状问题

1. 后端 `engine_send_message` 存在以全局 `active_engine` 作为分支依据的竞态窗口，快速切换时可能与请求线程归属不一致。
2. `ensureThread` 与 `onThreadSessionIdUpdated` 在双 pending 并存下仍含启发式兜底，极端并发会误重命名。
3. 歧义场景下缺少“拒绝迁移+等待后续强证据”的收敛策略。

## 方案（推荐）

- 前后端增加显式 `engine` 透传，后端优先使用请求内 engine；仅兜底才看 active engine。
- pending->session 以 `turnId` / `oldThreadId` / engine 前缀作为强证据链。
- 当候选>1 且无强证据时不迁移，记录 alias 窗口等待下一事件再收敛。
- 新增并发回归测试：双 pending、线程切换中发送、跨会话并发发送。

## 验收标准

1. OpenCode 并发切线程与发送时，不再出现回复跳到新 session 的体感问题。
2. 双 pending 并存下，会话回填仅发生在可确定目标线程时。
3. Claude/Codex 关键发送/中断行为保持不变。
4. OpenCode 相关前端测试与 `cargo test engine::` 回归通过。

## 影响范围

- Frontend: `useThreadMessaging.ts`, `useThreadTurnEvents.ts`, `useThreadsReducer.ts`
- Backend: `src-tauri/src/engine/commands.rs`, `src/services/tauri.ts`
- Tests: `useThreadMessaging.test.tsx`, `useThreadTurnEvents.test.tsx`, `useThreadsReducer.test.ts`
