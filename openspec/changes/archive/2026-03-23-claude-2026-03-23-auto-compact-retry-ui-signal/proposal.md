## Why

在 Codemoss 的 `Claude Code` 引擎会话中，长对话会命中 `Prompt is too long`，当前行为通常直接失败并中断当前任务。  
Claude CLI 实际具备 compact 生命周期信号（`system.compacting` / `compact_boundary`）与手动 `/compact` 能力，但当前接入链路没有把这些信号稳定落到现有 UI 状态流，也没有在超长上下文时做一次自动恢复。

这个缺口会导致两个问题：
- 用户感知上像“自动压缩失效”，但缺少可见证据；
- 失败后需要手工重试，影响连续任务执行体验。

## What Changes

### 目标与边界

本变更仅覆盖 `Claude Code` 引擎链路（thread id 前缀 `claude:` / `claude-pending-`）：

- 后端在命中 `Prompt is too long` 时，自动执行一次 `/compact`，并在同一 session 内重试原请求一次。
- 后端解析 Claude `system` 事件中的 compact 生命周期信号，并映射到已有线程事件流。
- 前端复用现有状态处理链路（`onContextCompacting` / `onContextCompacted`），不新增大型 UI 组件；`compact_boundary` 复用现有 `Context compacted.` 消息落地。
- 若需要“肉眼可见”的 compacting 过程，追加一条轻量提示（small hint），保持最小 UI 侵入。

### 非目标

- 不改 Codex / OpenCode / Gemini 的自动压缩或错误恢复策略。
- 不将 Codex 专属 dual-context 视图扩展到 Claude。
- 不引入多次自动重试循环（仅一次 compact + 一次重试）。
- 不改变现有手动 compact 行为入口（本变更聚焦 Claude 自动恢复与状态可见性）。

### 技术方案对比

| 方案 | 描述 | 优点 | 风险/缺点 | 结论 |
|---|---|---|---|---|
| A. 仅后端自动重试 | `Prompt is too long` 后仅做一次 `/compact` + retry | 实现快，纯逻辑改动 | 用户看不到 compact 生命周期，故障定位弱 | 不推荐单独采用 |
| B. 后端自动重试 + 复用现有状态流 | 在 A 基础上，将 `system.compacting` / `compact_boundary` 映射到现有线程事件；前端只接已有状态 | 风险低、边界清晰、用户可感知，不需新大组件 | 需要补齐 Claude 事件映射与测试 | **推荐** |
| C. 新增独立 Claude compact UI 面板 | 为 Claude 专门做新可视组件 | 视觉可见性最强 | 成本高、侵入大、偏离“最小改动” | 暂不采用 |

### 验收标准

1. **自动恢复触发**
   - GIVEN 当前线程为 `claude:*`
   - WHEN turn 失败且错误文本命中 `Prompt is too long`
   - THEN 系统 SHALL 自动发送一次 `/compact` 并重试原请求一次
   - AND 不得进入无限重试

2. **边界隔离**
   - GIVEN 当前线程为 `codex:*` / `opencode:*` / `gemini:*`
   - WHEN 发生任意 turn 错误
   - THEN 本自动 `/compact` 重试逻辑 SHALL NOT 执行

3. **生命周期可见性（最小 UI）**
   - GIVEN 当前线程为 `claude:*`
   - WHEN Claude 发出 `system.compacting`
   - THEN 前端 SHALL 进入既有 `context compacting` 状态流
   - WHEN Claude 发出 `compact_boundary`
   - THEN 前端 SHALL 追加现有 `Context compacted.` 语义消息（去重规则保持不变）

4. **可选轻量提示**
   - GIVEN 启用 compacting 可视提示
   - WHEN Claude compacting 进行中
   - THEN UI SHALL 显示轻量提示，不新增独立重型面板

## Capabilities

### New Capabilities
- `claude-context-compaction-recovery`: 针对 Claude Code 会话，提供超长上下文自动 compact 重试与 compact 生命周期事件可见化能力。

### Modified Capabilities
- `conversation-lifecycle-contract`: 增补 Claude compact 生命周期在统一会话事件流中的行为约束（仅限 Claude 引擎分支，不影响其他引擎语义）。

## Impact

- 受影响后端范围（Rust/Tauri）：
  - `src-tauri/src/engine/claude.rs`
  - `src-tauri/src/engine/events.rs`（若需要新增/映射 lifecycle 事件）
  - `src-tauri/src/engine/commands.rs`（如需调整转发/重试编排）
- 受影响前端范围（最小）：
  - `src/features/app/hooks/useAppServerEvents.ts`（消费映射后的事件）
  - `src/features/threads/hooks/useThreadTurnEvents.ts`（复用现有 compact 状态流）
  - 可选轻量提示位置（若启用）：`Composer` 相关状态文案层
- 测试影响：
  - 增补 Claude 引擎错误恢复与 compact 事件路由测试
  - 增补“仅 Claude 生效”的引擎边界测试
