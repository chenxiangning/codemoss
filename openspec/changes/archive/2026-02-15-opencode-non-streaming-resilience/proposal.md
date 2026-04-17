## Why

OpenCode CLI 的 `run --format json` 模式在设计上是**批量输出**——只有当 text part 完全生成后（`part.time?.end` 为
truthy）才向 stdout 输出 `"text"` 事件。这意味着在 LLM 思考/生成期间（GPT-5.3 等慢模型可能持续 2-5 分钟），CLI stdout **零输出
**，codemoss UI 表现为"假死"。用户无法区分"正在处理"和"真的卡死了"，严重损害可信度。

现有 spec 已定义 `Non-Streaming UX Hint` 和 `Terminal Completion Robustness` 需求，但前者尚未完整落地，后者仅覆盖后端超时兜底，缺少
**主动心跳**和**前端体验闭环**。在不改动 CLI 上游的约束下，需要从 Rust 后端和 React 前端两侧构建弹性层。

另一个高频问题是 Provider 指示灯会从绿色瞬时跳到红色，并同时导致输入区不可发送。当前状态链路对 `opencode auth list`
的单次失败过于敏感，且 `is-fail` 会被直接用于发送门控，容易把“瞬时探活失败”误判成“真实断连”。这会制造新的使用阻断，需要纳入同一提案一并修复。

## What Changes

### 后端 - Processing Heartbeat 机制

- **新增** `EngineEvent::ProcessingHeartbeat` 事件类型，携带 `elapsed_secs`、`model_hint`、`timeout_secs` 信息
- **新增** 后端心跳发射逻辑：在 `send_message` 主循环中，当 IO poll 超时（无 CLI 输出）且未收到首个 text 事件时，每隔 ~5 秒（随
  IO poll）向前端发送心跳事件
- **心跳 OpenCode-only**：通过引擎类型门控，Claude/Codex 路径不受影响

### 后端 - Dead Code 标注

- `parse_opencode_event` 中的 `content_delta`、`text_delta`、`output_text_delta`、`assistant_message_delta`、`message_delta`
  handler 标注为 `// FUTURE: reserved for potential CLI streaming mode`
- **不删除**（保持 forward-compatible），但加注释明确当前 CLI 不会触发

### 后端 - 超时预警信号

- **新增** `EngineEvent::TimeoutWarning` 事件：当已用时间达到模型超时的 80% 时发射一次
- **统一策略**：OpenCode 各模型使用一致的 idle timeout 策略（当前 300s），避免 provider/模型分支差异导致体验不一致
- 前端可据此展示"即将超时"的 actionable 提示

### 前端 - Non-Streaming Waiting State

- **落地** `Non-Streaming UX Hint` spec 需求
- 消费 `ProcessingHeartbeat` 事件，在消息区域展示动态等待状态：
    - 处理中动画（脉冲/呼吸灯效果）
    - 已等待时长（实时计数）
    - 当前模型名称提示
- 消费 `TimeoutWarning` 事件，展示预警条：
    - "模型响应较慢，你可以继续等待或取消重试"
    - 提供「取消」操作按钮

### 前端 - 引擎隔离

- 所有新增 UI 行为通过 `engine === "opencode"` 门控
- Claude/Codex 路径保持现有行为不变

### Provider 状态稳定性与误报防抖

- **新增** Provider 健康状态防抖（hysteresis）：单次探测失败不得立即从 `is-ok` 降为 `is-fail`
- **新增** 最近一次成功状态保留窗口（grace TTL）：在 TTL 内探测失败时降级为 `is-runtime` 而非 `is-fail`
- **新增** 会话优先策略：存在活跃 session/turn 时，Provider 状态下限为 `is-runtime`
- **调整** 发送门控：仅当连续失败达到阈值且无活跃会话时才阻断发送；其余情况显示 warning 但允许继续发送

## Capabilities

### New Capabilities

- `opencode-processing-heartbeat`: Rust 后端在 CLI 无输出期间向前端发送周期性心跳事件，携带 elapsed/timeout
  元数据。前端消费心跳展示动态处理状态。
- `opencode-timeout-prewarning`: 在会话超时触发前，后端发送一次预警事件，前端展示 actionable 提示（继续等待/取消）。
- `opencode-provider-status-stability`: Provider 状态使用防抖与会话优先策略，避免瞬时失败导致红灯和误阻断发送。

### Modified Capabilities

- `opencode-engine`: 需修改以下 requirement：
    - `OpenCode Non-Streaming UX Hint` - 当前仅定义"展示提示"，需扩展为消费 heartbeat 事件展示动态状态（elapsed
      time、处理动画），而非静态文案
    - `OpenCode Terminal Completion Robustness` - 补充 timeout warning 信号语义，在超时前给前端预警窗口

## Impact

### 改动文件

- `src-tauri/src/engine/events.rs` - 新增 `ProcessingHeartbeat`、`TimeoutWarning` 事件变体
- `src-tauri/src/engine/opencode.rs` - 心跳发射逻辑（`send_message` 主循环）、dead code 标注、timeout warning 发射
- `src/features/threads/hooks/useThreadTurnEvents.ts` - 消费新事件类型
- `src/features/messages/components/Messages.tsx` - 渲染等待状态和超时预警 UI
- `src/styles/messages.css` - 等待动画样式
- `src/features/opencode/hooks/useOpenCodeControlPanel.ts` - Provider 健康状态防抖、TTL、连续失败计数
- `src/features/opencode/components/OpenCodeControlPanel.tsx` - 状态映射（ok/runtime/fail）与会话优先降级
- `src/features/composer/components/Composer.tsx` - 发送门控从“单次 fail”改为“稳定 fail 才阻断”

### 不受影响

- Claude/Codex 引擎路径（引擎隔离门控）
- OpenCode CLI 上游（零改动）
- 现有超时机制（增量补充，不替换）
- 现有 thread 生命周期事件流（心跳是增量事件，不改变现有事件顺序）

### 依赖

- 无新外部依赖
- 使用 Tauri 现有 event emit 机制

## Implementation Trace

### 2026-02-15（本轮已落地）

- 后端新增并接通 `processing/heartbeat` 事件链路（Tauri -> app-server）：
    - `src-tauri/src/engine/events.rs`
    - `src-tauri/src/engine/opencode.rs`
- 前端事件消费新增 `onProcessingHeartbeat`：
    - `src/features/app/hooks/useAppServerEvents.ts`
    - `src/features/app/hooks/useAppServerEvents.test.tsx`
- 线程状态新增 heartbeat 脉冲并在处理中更新：
    - `src/features/threads/hooks/useThreadsReducer.ts`
    - `src/features/threads/hooks/useThreadEventHandlers.ts`
    - `src/features/threads/hooks/useThreadsReducer.test.ts`
- Messages 等待提示改为“按 heartbeat 脉冲变化随机更新”，不再仅依赖本地定时轮换：
    - `src/features/layout/hooks/useLayoutNodes.tsx`
    - `src/features/messages/components/Messages.tsx`
    - `src/features/messages/components/Messages.test.tsx`
- 测试稳定性微修复（防止 teardown 后 Markdown 节流定时器触发）：
    - `src/features/messages/components/Markdown.tsx`

### 本轮验证记录

- `npm run -s typecheck`：通过
-
`npx vitest run src/features/app/hooks/useAppServerEvents.test.tsx src/features/messages/components/Messages.test.tsx src/features/threads/hooks/useThreadsReducer.test.ts`
：通过（51 tests）
- `cargo check --manifest-path src-tauri/Cargo.toml`：通过（仅既有 warning）

### 尚未完成（后续）

- `TimeoutWarning` 事件与前端预警条/取消入口
- Provider 状态防抖与“稳定失败才阻断发送”策略
- `parse_opencode_event` 预留 streaming handler 注释化与相关补充测试
