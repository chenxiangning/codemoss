## Tasks

## Execution Log (2026-02-15)

- [x] Task 1（部分）: `ProcessingHeartbeat` 事件变体与 app-server method 转换已落地
- [x] Task 2: 后端心跳发射逻辑已落地（无首段文本期间周期发心跳）
- [ ] Task 3: `TimeoutWarning` 事件与预警链路未落地
- [x] Task 5（部分）: 前端已消费 `processing/heartbeat`
- [x] Task 6（部分）: 等待状态已按 heartbeat 脉冲更新随机提示文案
- [x] Task 7（部分）: 已补 heartbeat 相关前后端测试并通过
- [ ] Task 8: Provider 状态防抖与发送门控分级未在本轮落地

### 关联提交实现文件（本轮）

- `src-tauri/src/engine/events.rs`
- `src-tauri/src/engine/opencode.rs`
- `src/features/app/hooks/useAppServerEvents.ts`
- `src/features/app/hooks/useAppServerEvents.test.tsx`
- `src/features/threads/hooks/useThreadEventHandlers.ts`
- `src/features/threads/hooks/useThreadsReducer.ts`
- `src/features/threads/hooks/useThreadsReducer.test.ts`
- `src/features/layout/hooks/useLayoutNodes.tsx`
- `src/features/messages/components/Messages.tsx`
- `src/features/messages/components/Messages.test.tsx`
- `src/features/messages/components/Markdown.tsx`

### Task 1: 新增 EngineEvent 变体

**文件**: `src-tauri/src/engine/events.rs`

**子任务**:

1.1. 在 `EngineEvent` 枚举中新增 `ProcessingHeartbeat` 变体：

- serde rename: `"processing:heartbeat"`
- 字段: `workspace_id: String`, `elapsed_secs: u64`, `timeout_secs: u64`, `model_hint: Option<String>`

1.2. 在 `EngineEvent` 枚举中新增 `TimeoutWarning` 变体：

- serde rename: `"processing:timeoutWarning"`
- 字段: `workspace_id: String`, `elapsed_secs: u64`, `timeout_secs: u64`, `model_hint: Option<String>`

1.3. 更新 `workspace_id()` match，为两个新变体返回 `workspace_id`

1.4. 确认 `is_terminal()` 不匹配新变体（现有 `matches!` 只检查 TurnCompleted/TurnError，无需改动，但建议显式注释说明）

1.5. 在 `engine_event_to_app_server_event` 函数中新增两个变体的 JSON-RPC 转换：

- `ProcessingHeartbeat` → method: `"processing/heartbeat"`, params: `{ threadId, elapsedSecs, timeoutSecs, modelHint }`
- `TimeoutWarning` → method: `"processing/timeoutWarning"`, params: `{ threadId, elapsedSecs, timeoutSecs, modelHint }`

1.6. 新增单元测试：

- `ProcessingHeartbeat` 的 `workspace_id()` 返回正确值
- `ProcessingHeartbeat` 的 `is_terminal()` 返回 false
- `TimeoutWarning` 的序列化格式正确
- `engine_event_to_app_server_event` 对两个新事件的转换输出符合预期

**验证**: `cargo test` 通过，无编译错误

---

### Task 2: 后端心跳发射逻辑

**文件**: `src-tauri/src/engine/opencode.rs`

**子任务**:

2.1. 在 `send_message` 主循环中，`Err(_)` 分支（IO poll 超时）内添加心跳发射逻辑：

- 条件: `text_delta_count == 0 && active_tool_calls <= 0 && !saw_turn_completed`
- 动作: `self.emit_turn_event(turn_id, EngineEvent::ProcessingHeartbeat { ... })`
- `elapsed_secs`: `started_at.elapsed().as_secs()`
- `timeout_secs`: `model_idle_timeout.as_secs()`
- `model_hint`: 从 `effective_params` 中提取模型名称（若有）

2.2. 确保心跳在首个 text delta 到达后自动停止（`text_delta_count == 0` 条件已保证）

2.3. 确保心跳在工具调用开始后自动停止（`active_tool_calls <= 0` 条件已保证）

**验证**: 手动测试 — 在 OpenCode 模式下发送一条慢模型消息，观察 Tauri devtools 中是否每 ~5s 出现 `processing/heartbeat`
事件

---

### Task 3: 后端超时预警发射逻辑

**文件**: `src-tauri/src/engine/opencode.rs`

**子任务**:

3.1. 在 `send_message` 函数中新增局部变量 `let mut timeout_warning_emitted = false;`

3.2. 在主循环 `Err(_)` 分支内，心跳逻辑之后，添加 timeout warning 检查：

- 条件: `!timeout_warning_emitted && started_at.elapsed() >= model_idle_timeout * 4 / 5`
- 动作: `self.emit_turn_event(turn_id, EngineEvent::TimeoutWarning { ... })`
- 设置: `timeout_warning_emitted = true`

3.3. 使用整数运算 `model_idle_timeout * 4 / 5` 而非浮点数 `* 0.8`（Duration 不支持浮点乘法）

**验证**: 手动测试 — 在当前统一 300s timeout 策略下，确认在 ~240s 时收到一次 `processing/timeoutWarning` 事件，且不重复

---

### Task 4: Dead Code Handler 标注

**文件**: `src-tauri/src/engine/opencode.rs`

**子任务**:

4.1. 在 `parse_opencode_event` 函数中以下 match 分支上方添加注释：

- `"content_delta"` 分支（第 704 行附近）
- `"text_delta" | "output_text_delta" | "assistant_message_delta" | "message_delta"` 分支（第 718 行附近）

4.2. 注释内容:

   ```
   // FUTURE: reserved for potential CLI streaming mode.
   // Current CLI (run --format json) only emits complete "text" events
   // when part.time?.end is truthy. These handlers are retained for
   // forward-compatibility if CLI adds streaming output support.
   ```

**验证**: `cargo clippy` 无新 warning

---

### Task 5: 前端消费新事件类型

**文件**: `src/features/threads/hooks/useThreadTurnEvents.ts`（或对应的事件消费 hook）

**子任务**:

5.1. 在事件消费 switch/if 中新增对 `processing/heartbeat` method 的处理：

- 提取 `elapsedSecs`、`timeoutSecs`、`modelHint`
- 更新 thread/turn 的处理状态（如 `heartbeatReceived: true`、`lastHeartbeatAt: Date.now()`）

5.2. 新增对 `processing/timeoutWarning` method 的处理：

- 设置 `timeoutWarningReceived: true`、`timeoutSecs`

5.3. 确保在 `turn/completed`、`turn/error` 时清理心跳/预警相关状态

5.4. 引擎隔离：确认这些事件 method name 仅 OpenCode 后端会发射，前端处理侧无需额外 engine 检查（但渲染侧需要）

**验证**: TypeScript 编译通过，相关状态在 React DevTools 中可观察

---

### Task 6: 前端等待状态 UI 渲染

**文件**: `src/features/messages/components/Messages.tsx`, `src/styles/messages.css`

**子任务**:

6.1. 新增 `OpenCodeWaitingState` 组件（或在 Messages 中内联），条件渲染：

- 当 `engine === "opencode"` && turn 正在处理 && 无 text delta 到达时显示
- 包含: 脉冲动画 icon、"正在等待模型响应..."文案、elapsed 秒数计数器、模型名（若有）
- 使用 `setInterval(1000)` 驱动秒数更新，在 text 到达或 turn 结束时清理

6.2. 新增 `OpenCodeTimeoutWarning` 组件（或在等待状态内条件渲染）：

- 当 `timeoutWarningReceived == true` 且等待 UI 仍在显示时出现
- 包含: 警告文案 + 「取消」按钮
- 取消按钮调用现有 interrupt 方法

6.3. CSS 动画样式：

- 脉冲/呼吸灯效果（使用 `@keyframes` + `animation`）
- 预警条样式（浅黄色/橙色背景 + 边框）
- 确保与现有 messages 区域视觉一致

6.4. 确保以下清理时机：

- 收到 `item/agentMessage/delta`（text 到达）→ 隐藏等待 UI
- 收到 `turn/completed` → 隐藏等待 UI + 预警条
- 收到 `turn/error` → 隐藏等待 UI + 预警条

6.5. 引擎隔离门控：所有新增 UI 通过 `engine === "opencode"` 条件渲染

**验证**:

- OpenCode 模式下发送消息，看到等待动画和计时器
- 收到响应后等待 UI 消失
- Claude/Codex 模式下无等待 UI 出现

---

### Task 7: 测试补充

**文件**: 新增/修改测试文件

**子任务**:

7.1. Rust 后端单元测试（`events.rs` 中）：

- ProcessingHeartbeat 序列化 / 反序列化
- TimeoutWarning 序列化 / 反序列化
- `engine_event_to_app_server_event` 转换逻辑

7.2. 前端组件测试（`Messages.test.tsx` 或新增 `OpenCodeWaitingState.test.tsx`）：

- 等待 UI 在 opencode engine + processing 状态时出现
- 等待 UI 在 text delta 到达后消失
- 等待 UI 在 non-opencode engine 时不出现
- 预警条在 timeoutWarning 收到时出现
- 取消按钮触发 interrupt

7.3. 前端事件消费测试（`useThreadTurnEvents.test.ts` 如果存在）：

- `processing/heartbeat` 事件正确更新状态
- `processing/timeoutWarning` 事件正确更新状态
- `turn/completed` 正确清理状态

**验证**: `cargo test` + `npm test` 全部通过

---

### Task 8: Provider 状态稳定性修复（新增）

**文件**: `src/features/opencode/hooks/useOpenCodeControlPanel.ts`,
`src/features/opencode/components/OpenCodeControlPanel.tsx`, `src/features/composer/components/Composer.tsx`

**子任务**:

8.1. 在 provider 健康状态链路加入防抖状态机：

- 跟踪连续失败次数 `consecutiveFailures`
- 跟踪最近成功时间 `lastHealthyAt`
- 引入 grace TTL（例如 15-30s）

8.2. Provider tone 计算调整：

- 单次失败或 TTL 内失败：`is-runtime`
- 仅在连续失败达阈值且无活跃 session 时：`is-fail`
- 有活跃 session/turn 时 tone 下限为 `is-runtime`

8.3. Composer 发送门控改为“稳定 fail 才阻断”：

- 瞬时失败（runtime）显示 warning，但允许发送
- 稳定 fail（达阈值）再禁用发送按钮

8.4. 提示文案与观测：

- 对 `is-runtime` 增加“正在复核连接状态”提示
- 对 `is-fail` 保留可操作的重连引导

**验证**:

- 模拟一次 `opencode auth list` 失败时，不应立刻红灯并阻断发送
- 活跃会话中即使探测失败，状态应为 `is-runtime` 非 `is-fail`
- 连续失败达到阈值后才进入 `is-fail`

---

## 任务依赖关系

```
Task 1 (EngineEvent 变体)
  ├── Task 2 (心跳发射) ← 依赖 Task 1
  ├── Task 3 (超时预警发射) ← 依赖 Task 1
  └── Task 4 (Dead code 标注) ← 无依赖，可并行
Task 5 (前端事件消费) ← 依赖 Task 1（需要知道 method name）
Task 6 (前端 UI 渲染) ← 依赖 Task 5
Task 7 (测试) ← 依赖 Task 1-6 全部完成
```

## 建议执行顺序

1. **Phase 1 (后端)**：Task 1 → Task 2 + Task 3 + Task 4（并行）
2. **Phase 2 (前端)**：Task 5 → Task 6
3. **Phase 3 (测试)**：Task 7
