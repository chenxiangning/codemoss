# Proposal: OpenCode Engine Isolation Hardening

## 目标与边界

本变更目标是将 OpenCode 新能力与既有 Claude/Codex 运行链路进行“行为隔离加固”，确保：

- 线程已创建后，发送/中断路由由“线程归属引擎”决定，不被当前 UI 选中引擎误导。
- OpenCode 的 pending 会话回填不影响 Claude/Codex 线程稳定性。
- 共享事件管线继续复用，但在引擎判定处具备确定性。

边界：仅覆盖 `threads/hooks` 与引擎路由判定，不重写后端引擎实现，不改 UI 风格。

## 非目标

- 不改 Claude/Codex/OpenCode 各自 CLI 协议与 provider 登录机制。
- 不做大规模状态管理重构（如替换 reducer 架构）。
- 不引入新依赖或跨仓库协议变更。

## 现状问题

- 前端部分路由逻辑优先依赖 `activeEngine`，在线程已存在且引擎切换后可能误路由。
- `interrupt` 路径对 CLI managed engine 的判断存在跨引擎混用窗口。
- `pending -> session` 回填在双 pending 并存场景下存在歧义，导致偶发线程迁移异常。

## 方案对比

### 方案 A（推荐）：线程归属优先 + activeEngine 仅用于新建线程

- 发送/中断：先根据 `threadId` 或 `thread.engineSource` 判断引擎。
- `activeEngine` 仅在“无 threadId/新建 thread”阶段生效。
- 会话回填：按 `pending thread -> turn binding -> processing status` 进行确定性匹配。

优点：最小侵入、回归风险可控、与现有 reducer 模式兼容。  
缺点：仍保留共享事件总线，逻辑复杂度中等。

### 方案 B：按引擎拆分三套事件处理器与发送入口

- 完全拆分 Claude/Codex/OpenCode hook 链路。

优点：隔离最彻底。  
缺点：改动面大、重复代码显著、短期回归风险高。

决策：采用方案 A。

## 验收标准

1. 在 Codex 线程中将 UI 切到 OpenCode 后执行发送/中断，仍走 Codex 路由。
2. 在 OpenCode 线程中将 UI 切到 Claude 后执行发送/中断，仍走 OpenCode 路由。
3. 同一 workspace 中同时存在 `claude-pending-*` 与 `opencode-pending-*` 时，会话回填可确定落到正确线程。
4. 不影响旧行为：Claude 会话恢复、Codex token_count 归集、OpenCode agent/variant 参数透传保持可用。
5. 前端单测新增覆盖并通过；引擎相关 Rust 测试通过。

## 影响范围

- Frontend: `useThreadMessaging.ts`, `useThreadTurnEvents.ts`, `useThreads.ts`（仅判定逻辑）
- Tests: `useThreadMessaging.test.tsx`, `useThreadTurnEvents.test.tsx`, `useThreadsReducer.test.ts`
- Spec delta: `opencode-engine`
