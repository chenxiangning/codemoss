## Context

OpenCode CLI 的 `run --format json` 模式是**批量输出设计**（`part.time?.end` 为 truthy 才 emit `"text"` 事件）。这意味着
LLM 生成期间 CLI stdout 零输出，Rust 后端的 `send_message` 主循环在 IO poll 超时分支（`Err(_)` 即
`OPENCODE_IO_POLL_INTERVAL` 5s timeout）中仅做 idle 计时，不向前端发送任何信号。前端 UI 表现为完全"假死"。

**约束**：CLI 上游不可修改。所有弹性措施必须在 codemoss 的 Rust 后端与 React 前端之间闭环。

**现有基础设施**：

- `EngineEvent` 枚举（`events.rs`）是统一事件类型，通过 `engine_event_to_app_server_event` 转换为 Codex-compatible JSON-RPC
  格式后经 Tauri emit 到前端
- `send_message` 主循环（`opencode.rs:330-446`）已有 IO poll 超时分支、idle timeout 计算、`text_delta_count` 计数器
- 前端通过 `useThreadTurnEvents.ts` / `useAppServerEvents` 消费事件
- 前端已有 Non-Streaming Hint 占位（但实现为静态文案，未接入动态心跳）

## Goals / Non-Goals

### Goals

1. **消除假死感知**：用户在 LLM 生成等待期间能看到明确的"正在处理"信号（动画 + 计时 + 模型名）
2. **可预测的超时预期**：在全局超时触发前给用户预警窗口，提供 cancel 操作
3. **引擎隔离**：所有新行为 OpenCode-only，Claude/Codex 路径零变更
4. **Dead code 可维护性**：标注不会被当前 CLI 触发的 handler，保持前向兼容

### Non-Goals

- 修改 OpenCode CLI 上游（明确约束）
- 实现真正的 streaming 传输（CLI 设计决定了不可能）
- 改变现有超时机制的数值或行为（增量补充，不替换）
- 修改 Claude/Codex 引擎的任何行为

## Decisions

### D1: 心跳机制实现位置

**选项对比**：

| 方案                               | 描述                                         | 优点                       | 缺点                                      |
|----------------------------------|--------------------------------------------|--------------------------|-----------------------------------------|
| **A: send_message IO poll 分支内嵌** | 在 `Err(_)` 超时分支中直接 emit 心跳                 | 零新线程；复用现有 poll 间隔；代码改动最小 | 心跳间隔受 IO_POLL_INTERVAL(5s) 约束，不够灵活      |
| B: 独立 tokio::spawn 心跳任务          | spawn 一个独立 task，使用 tokio::interval 定期 emit | 间隔完全可控；与主循环解耦            | 需要跨 task 共享状态（text_delta_count）；增加并发复杂度 |
| C: 前端纯本地计时                       | 后端不改，前端在 turn:started 后自行计时                | 零后端改动                    | 前端无法知道后端真实处理状态；计时不反映 CLI 活跃度            |

**决策：A（send_message IO poll 分支内嵌）**

理由：

- `OPENCODE_IO_POLL_INTERVAL` 已是 5s，心跳每次 poll 超时且满足条件时发射，实际间隔 ~5s，对用户感知而言足够
- 主循环内可直接读取 `text_delta_count`、`started_at`、`active_tool_calls` 等局部状态，无需跨 task 同步
- 方案 B 的独立 task 需要 Arc<AtomicU64> 等同步原语来共享 `text_delta_count`，而该变量是主循环局部变量，重构开销大
- 方案 C 失去了后端真实 liveness 信号的价值——前端自己计时无法区分"后端还在等 CLI"和"后端已经 crash"

### D2: 心跳事件通过 EngineEvent 还是独立通道

**选项对比**：

| 方案                        | 描述                                                      | 优点                 | 缺点                                                        |
|---------------------------|---------------------------------------------------------|--------------------|-----------------------------------------------------------|
| **A: 新增 EngineEvent 变体**  | 在 EngineEvent 枚举中加 ProcessingHeartbeat / TimeoutWarning | 复用完整事件管线；前端消费路径统一  | EngineEvent 枚举变大；需更新 workspace_id() / is_terminal() match |
| B: 独立 Tauri event channel | 使用独立的 `app.emit("opencode-heartbeat", ...)`             | 不影响 EngineEvent 枚举 | 前端需要新增事件监听器；事件生命周期与 turn 脱钩                               |

**决策：A（新增 EngineEvent 变体）**

理由：

- 心跳和预警在语义上是 turn 生命周期的一部分（turn 期间发射，turn 结束即停止）
- 复用 `emit_turn_event` → `engine_event_to_app_server_event` → `AppServerEvent` 管线，前端无需新增事件监听
- 方案 B 虽然解耦但引入了两个并行事件流，增加前端 reconcile 复杂度

### D3: 心跳触发条件

心跳应在 IO poll 超时分支中，满足以下全部条件时发射：

```
text_delta_count == 0        // 尚未收到首个 text 事件
&& active_tool_calls <= 0    // 没有工具调用在进行
&& !saw_turn_completed       // turn 未完成
```

当 `text_delta_count > 0` 后停止心跳——此时文本已到达，synthetic stream 接管 UI 反馈。

### D4: TimeoutWarning 发射策略

- **触发时机**：`started_at.elapsed() >= model_idle_timeout * 80%`
- **发射次数**：仅一次（用 `bool timeout_warning_emitted` 门控）
- **携带信息**：`elapsed_secs`、`timeout_secs`、`model_hint`

选择 80% 而非固定阈值（如 90s），在统一 timeout 策略下依然成立：

- 统一策略：300s → 预警 @ 240s
- 若未来调整 timeout 常量，80% 仍可自动适配

### D5: 前端消费方式

**选项对比**：

| 方案                          | 描述                                                                     | 优点            | 缺点                                     |
|-----------------------------|------------------------------------------------------------------------|---------------|----------------------------------------|
| **A: 现有 AppServerEvent 管线** | 心跳事件通过 engine_event_to_app_server_event 转换，前端在 useThreadTurnEvents 中消费 | 统一管线；无需新 hook | 需要在 AppServerEvent 层定义新 method name    |
| B: 独立 React state + effect  | 前端在 turn 开始时启动本地计时器，心跳事件仅用于"确认后端存活"                                    | 计时器 UI 更平滑    | 两套计时逻辑（前端 interval + 后端事件）需要 reconcile |

**决策：A+B 混合方案**

- 后端心跳通过 AppServerEvent 管线传递（JSON-RPC method = `"processing/heartbeat"` 和 `"processing/timeoutWarning"`）
- 前端在收到 `turn/started` 后启动本地 `setInterval`（每秒更新 elapsed 显示），收到心跳事件时 **reset liveness flag**
- 如果连续 N 次（如 15s = 3 次心跳间隔）未收到心跳，前端可以显示"可能已断开"提示
- 收到 `text:delta` 或 `turn:completed` 或 `turn:error` 后自动清理计时器和等待 UI

这样 UI 计时是前端自己的 1s interval（平滑），而后端心跳用于证明"后端仍在正常等待 CLI 输出"。

### D6: Dead Code Handler 处理方式

**决策：标注保留，不删除**

- `content_delta`、`text_delta`、`output_text_delta`、`assistant_message_delta`、`message_delta` 五个 handler 当前 CLI 不会触发
- 但如果 CLI 未来支持 streaming mode，这些 handler 是正确的接收端
- 标注为
  `// FUTURE: reserved for potential CLI streaming mode — current CLI (run --format json) only emits complete "text" events`
- 不影响运行时行为（事件类型不匹配就不会进入这些分支）

### D7: Provider 状态防抖与发送门控

问题根因：

- Provider 状态来自 `opencode auth list`，该命令可能受瞬时环境因素影响（短暂 IO/权限/CLI 状态波动）返回失败。
- 当前 UI 将单次失败直接映射到 `is-fail`，且 `is-fail` 直接触发发送禁用，导致“绿灯突然红灯 + 输入区红色不可用”。

决策：

- 引入连续失败阈值（例如 2-3 次）与 TTL 保留（例如 15-30s）：
    - 单次失败：`is-ok` -> `is-runtime`（不阻断发送）
    - 连续失败达到阈值且无活跃 session：`is-fail`（可阻断）
- 会话优先策略：若存在活跃 session/turn，则 Provider 最低显示为 `is-runtime`。
- 发送门控改为“稳定 fail 才阻断”，瞬时失败仅展示 warning。

## Risks / Trade-offs

### R1: 心跳间隔粒度（中等风险）

- **风险**：IO_POLL_INTERVAL 为 5s，心跳间隔也是 ~5s，用户在前 5s 仍然看不到任何信号
- **缓解**：前端在收到 `turn/started` 后立即显示等待 UI（不依赖首个心跳），心跳仅用于持续确认后端存活
- **替代方案**：如果 5s 体验不够好，可以将 IO_POLL_INTERVAL 改为 3s，但会增加 lock 获取频率（`last_io_activity.lock().await`
  ），对性能影响极小

### R2: EngineEvent 枚举膨胀（低风险）

- **风险**：新增 2 个变体让枚举从 13 个变体增长到 15 个
- **缓解**：这些变体携带简单的标量字段（elapsed_secs, timeout_secs, model_hint），不影响枚举整体大小
- **需要更新**：`workspace_id()`、`is_terminal()` 的 match 分支、`engine_event_to_app_server_event` 的转换逻辑

### R3: 前端计时器与后端心跳的时间漂移（低风险）

- **风险**：前端 setInterval 和后端 elapsed_secs 可能有 1-2s 偏差
- **缓解**：前端 UI 显示的是前端自己的计时器（保证平滑），心跳事件仅作 liveness 信号，不用于校准前端时间

### R4: Engine isolation 门控遗漏（中等风险）

- **风险**：新增的等待 UI 或心跳处理如果没有正确门控，可能影响 Claude/Codex 路径
- **缓解**：
    - 后端侧：心跳发射逻辑仅在 `OpenCodeSession::send_message` 内（Claude/Codex 不走这个函数）
    - 前端侧：心跳事件的 JSON-RPC method 是 OpenCode 专属（`processing/heartbeat`），现有 Claude/Codex handler 不会匹配
    - 前端等待 UI 需要显式检查 `engine === "opencode"` 门控

### R5: Provider 状态防抖阈值过宽（中等风险）

- **风险**：阈值/TTL 设得过大，会让真实断连在 UI 上反应滞后。
- **缓解**：
    - 将 `is-runtime` 明确标记为“临时状态待确认”。
    - 在无活跃 session 且连续失败达到阈值时仍快速降级到 `is-fail`。
    - 保留手动“刷新状态/重试”入口。

## Migration Plan

无需迁移——所有变更都是增量添加：

- 后端新增事件变体和发射逻辑，不修改现有事件语义
- 前端新增 UI 组件和事件消费逻辑，不修改现有渲染路径
- 无数据模型变更、无持久化变更、无 CLI 接口变更

上线后可通过观察以下指标验证：

- 心跳事件是否在 CLI 无输出期间按预期频率到达前端（Tauri devtools 可观察）
- 前端等待 UI 是否正确显示和自动清理
- Claude/Codex 路径是否保持不变（回归测试）

## Open Questions

1. **心跳间隔是否需要可配置？** 当前硬编码为 IO_POLL_INTERVAL（5s），如果未来发现用户反馈"等太久才看到信号"，可以考虑将 poll
   interval 降至 3s。但这需要评估 async lock 频率的影响。暂不实现。

2. **TimeoutWarning 的 cancel 操作是否要自动 kill 进程？** 当前设计是前端展示 cancel 按钮，点击后调用现有的 `interrupt()`
   方法。需确认 interrupt 在 CLI 等待响应期间能否正常 kill。根据现有代码（`opencode.rs:516-527`），interrupt 是通过
   `child.kill()` 实现的，应该能正常工作。

3. **心跳事件是否需要在 `engine_event_to_app_server_event` 中声明 `is_terminal() == false`？** 是的，心跳和预警都不是
   terminal 事件。`is_terminal()` 的 match 需要为新变体显式返回 false（默认行为已是 false，但为了可维护性应该显式列出）。
