# Design

## 概览

自动流由 `third_party_messages` 模块承载，触发点为飞书 WS 入站事件写入后的异步处理：

1. 入站事件标准化并去重。
2. 若为新消息，异步触发 auto flow。
3. auto flow 在 feature flag 打开时执行：
   - 自动创建/复用 external session
   - 引擎选择状态机
   - 调用引擎同步生成回复
   - 回发飞书并写审计/指标

## 状态字段扩展（ExternalSession）

- `autoMode: bool`
- `awaitingEngineSelection: bool`
- `selectedEngine: Option<String>` (`codex|claude`)
- `engineSessionId: Option<String>`（主要用于 Claude 会话延续）
- `lastInboundMessageId: Option<String>`（防重复处理）

## 自动状态机

- 新会话：`awaitingEngineSelection=true`，发送选择提示。
- 选择阶段：
  - 命中 `codex/1` -> `selectedEngine=codex`
  - 命中 `claude/2` -> `selectedEngine=claude`
  - 未命中 -> 发送“无效选择”提示
- 会话阶段：按 `selectedEngine` 自动请求引擎并回发。

## 并发与幂等

- 使用模块级 async mutex 保护 auto flow 临界区。
- 基于 `lastInboundMessageId` 做二次幂等，避免重复回复。

## 引擎调用策略

- Claude：使用 `engine_send_message_sync` + `sessionId` 连续会话。
- Codex：使用 `engine_send_message_sync`，并附带最近审计上下文构造 prompt（MVP）。

## 失败处理

- 回复失败与引擎失败均记录审计与指标。
- 失败文案回发飞书（保证用户侧有反馈，不静默丢失）。
