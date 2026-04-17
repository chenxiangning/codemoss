## Context

当前 CodeMoss 对 Codex 的上下文压缩仅做展示侧消费：前端可读取 `token_count` / `thread/tokenUsage/updated` 与 `thread/compacted`，但缺少“本地自动触发压缩”的执行链路。结果是当会话进入高占用时，系统只能等待引擎被动压缩，无法像 Codex.app 一样在占比接近上限时主动启动压缩流程。

受影响模块跨越 Rust app-server 桥接层与前端事件消费层：
- Rust: `src-tauri/src/backend/app_server.rs`（Codex app-server 事件主循环）
- Frontend: `src/features/app/hooks/useAppServerEvents.ts`、`src/features/threads/hooks/useThreadTurnEvents.ts`

约束：
- 仅 `codex` 会话可触发自动压缩。
- 不修改既有线程协议的必选字段，不破坏 legacy 线程行为。
- 默认参数可内置常量；不新增全局设置入口。

## Goals / Non-Goals

**Goals:**
- 在 Codex runtime 层实现自动压缩调度：高占比触发、冷却保护、单线程幂等。
- 通过真实 RPC 请求触发压缩，而非 UI 伪状态。
- 新增 `thread/compacting` 事件，补齐“开始压缩”状态信号。
- 压缩失败可恢复：不阻断会话，不形成请求风暴。

**Non-Goals:**
- 不做跨引擎统一压缩框架。
- 不引入手动压缩入口。
- 不改会话落盘主结构（`.codex/sessions` / `archived_sessions`）。

## Decisions

### Decision 1: 调度器放在 Rust app-server 事件循环（选用）

- 方案 A：前端监听 token 后调用压缩 RPC。
  - 优点：实现快。
  - 缺点：生命周期依赖前端页面/线程激活状态，后台线程不稳定。
- 方案 B：Rust 会话层调度（选用）。
  - 优点：与 Codex 会话进程同生命周期，后台线程也能稳定触发。
  - 缺点：需要新增会话内状态机。

结论：采用 B。

### Decision 2: 触发条件采用“高水位 + 空闲 + 冷却”

- 阈值：`>= 92%` 进入待压缩。
- 空闲：仅在线程 `!processing` 时触发压缩请求（避免与正常 turn 冲突）。
- 冷却：同线程默认 `90s` 内最多触发一次。

这样可避免高频 `token_count` 导致的压缩风暴。

### Decision 3: 压缩 RPC 采用多方法回退探测

考虑 Codex app-server 协议版本差异，按顺序尝试：
1. `thread/compact/start`
2. `thread/compactStart`
3. `thread/compact`

参数统一使用 `{ "threadId": <id> }`。若当前方法返回 error，则回退下一候选。

### Decision 4: 事件语义

- 压缩开始（本地合成）：发 `thread/compacting`。
- 压缩完成（引擎原生）：消费 `thread/compacted`。
- 压缩失败（本地合成）：发 `thread/compactionFailed`（仅诊断，不改变主流程）。

前端不承担调度，只负责展示状态与记录活动。

### Decision 5: 失败处理

- 启动压缩失败：清理 `in_flight` 并记录 `last_failure_at`，维持冷却窗口，防止重试风暴。
- 失败不影响后续 `send_user_message`。
- 任何异常降级为“仅日志 + 不中断会话”。

## Risks / Trade-offs

- [Risk] Codex app-server 方法名与预期不一致  
  → Mitigation: 三段候选方法回退；失败事件与日志可观测。

- [Risk] 压缩请求与普通 turn 并发导致冲突  
  → Mitigation: 仅在 `!processing` 触发；每线程 `in_flight` 锁与 cooldown。

- [Risk] 误触发频繁压缩影响体验  
  → Mitigation: 高水位触发 + 低频触发 + 完成后清理 pending。

- [Risk] 前端状态与后端状态短暂不一致  
  → Mitigation: 新增 `thread/compacting` 显式事件；保留 `thread/compacted` 作为完成信号。

## Migration Plan

1. 在 `WorkspaceSession` 增加自动压缩线程态（usage、processing、in_flight、cooldown）。
2. 在 app-server stdout 事件循环接入调度函数：
   - 更新线程 token 与 processing 状态
   - 判定触发条件
   - 异步发送 compact 请求
3. 增加本地事件发射：`thread/compacting` / `thread/compactionFailed`。
4. 前端事件路由新增 `thread/compacting` 分支并联动线程状态更新。
5. 增加单测：
   - 阈值判定
   - 冷却判定
   - 方法回退
   - codex-only 约束
6. 回归验证后灰度启用（默认常量开启，如需回退可在 Rust 常量开关关闭）。

### Rollback

- 快速回退：关闭 Rust 自动压缩总开关常量（或直接短路触发条件）。
- 前端仍可继续显示 token 占比，不影响既有发送与会话流程。

## Open Questions

- 是否需要将阈值/冷却做成可配置项并暴露到 settings（当前提案先不暴露）。
- 是否需要在状态栏增加“最近一次自动压缩时间”诊断信息。
