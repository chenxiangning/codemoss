## Context

当前 `Claude Code` 会话链路存在两处断点：

1. `Prompt is too long` 触发后仅报错，不做自动恢复，用户需要手工输入 `/compact` 再重试。
2. Claude CLI 的 compact 生命周期信号（`system.compacting` / `compact_boundary`）没有稳定映射到现有前端线程事件流，导致“是否在压缩”不可见。

现有代码基础：
- 后端已存在跨引擎统一事件转发能力（`EngineEvent -> AppServerEvent`）。
- 前端已具备 `thread/compacting`、`thread/compacted`、`thread/compactionFailed` 的消费链路和状态更新（`onContextCompacting/onContextCompacted`）。
- 现有“Context compacted.”消息与去重机制可直接复用。

约束：
- 变更必须只作用于 `Claude` 引擎，不影响 `Codex/OpenCode/Gemini`。
- 前端只做最小改动，不引入重型新组件。

## Goals / Non-Goals

**Goals:**
- 在 Claude 会话命中 `Prompt is too long` 时自动执行一次 `/compact`，并自动重试原请求一次。
- 把 Claude compact 生命周期信号接入现有线程状态流，让用户可观察到 compacting/compacted。
- 保持引擎边界严格隔离，仅对 `claude:*` 线程生效。

**Non-Goals:**
- 不复用/改造 Codex 自动压缩调度器，不扩展到其他引擎。
- 不新增 Claude 专用大型面板或双上下文视图。
- 不实现多轮自动重试（避免重试风暴）。

## Decisions

### Decision 1: 采用“Claude 本地恢复链路”，不复用 Codex auto-compaction 调度

**选择**  
在 `Claude` 引擎路径内实现一次性恢复：检测 `Prompt is too long` → 发 `/compact` → 重试原请求一次。

**原因**  
- Codex auto-compaction 调度器当前显式排除 `claude:*` 线程，直接复用会扩大变更面并引入跨引擎耦合。
- Claude 的失败语义来自 CLI 流/退出态，最稳妥位置是 Claude session 自身控制流。

**备选方案**
- 方案 A：接入 Codex 统一调度器。  
  缺点：破坏引擎边界，风险高。
- 方案 B：仅前端引导用户手工 `/compact`。  
  缺点：无法消除失败中断。

### Decision 2: 复用现有 `thread/compacting` / `thread/compacted` 事件，不新增前端协议

**选择**  
将 Claude `system.compacting` / `compact_boundary` 映射为现有线程事件：
- `system.compacting` -> `thread/compacting`
- `compact_boundary` -> `thread/compacted`

**原因**  
- 前端已有稳定消费与状态更新逻辑，可直接得到“最小 UI 变更”。
- 可复用已有 `Context compacted.` 文案与去重逻辑，减少新状态面。

**备选方案**
- 方案 A：新增 `thread/claudeCompacting` 等新协议。  
  缺点：前后端都要扩展，测试面变大。
- 方案 B：仅保留 `claude/raw` 调试事件。  
  缺点：用户不可见，无法解决感知问题。

### Decision 3: 自动恢复只允许“一次 compact + 一次重试”，并做线程边界守卫

**选择**  
每个 Claude turn 设置单次恢复护栏：
- 仅在命中超长上下文错误且未重试过时触发；
- compact 成功后仅重试一次原请求；
- 再次失败则正常抛错，终止恢复链路。

**原因**  
- 防止循环重试与重复压缩。
- 语义可预测，便于测试和回归验证。

**备选方案**
- 方案 A：无限/多次重试。  
  缺点：可能导致长时间阻塞与不可控失败风暴。
- 方案 B：完全不重试。  
  缺点：无法提升成功率。

### Decision 4: 可视提示采用“轻量 hint”并默认可关闭

**选择**  
`compacting` 过程可选显示一条轻量提示（如状态文案/短暂提示），不新增面板结构。

**原因**  
- 满足“肉眼可见”诉求，同时保持 UI 最小侵入。
- 即使不启用 hint，`thread/compacting` 仍能驱动既有状态。

## Risks / Trade-offs

- [错误匹配不稳] 仅匹配单一英文字符串可能漏判。  
  → Mitigation: 使用标准化匹配（大小写/前后缀清洗）并覆盖常见变体；测试覆盖 CLI 错误文本样本。

- [重试副作用] 原请求包含状态敏感操作时，重试可能重复执行。  
  → Mitigation: 将自动恢复仅绑定在“首包前失败且错误为 Prompt 过长”的场景；保持一次重试上限。

- [事件映射漂移] Claude CLI 未来可能调整 `system` 字段。  
  → Mitigation: 解析策略容错（snake/camel + subtype/status 双路径），未知字段回退为 no-op。

- [跨引擎回归] 共享事件管道改动可能影响其他引擎。  
  → Mitigation: 显式线程前缀守卫 + 回归测试验证 codex/opencode/gemini 不变。

## Migration Plan

1. 后端实现（Claude only）
   - 在 Claude session 错误处理路径中增加超长上下文检测与单次恢复流程。
   - 新增 compact 生命周期事件映射，输出为现有 `thread/compacting` / `thread/compacted`。

2. 前端最小接入
   - 复用现有 `useAppServerEvents` 与 `useThreadTurnEvents` 处理链路。
   - `compact_boundary` 落入现有 `Context compacted.` 语义消息。
   - 可选：增加轻量 `compacting` 提示，不改变布局结构。

3. 测试与验收
   - Rust: Claude 错误恢复单测（触发条件、单次重试、失败回退）。
   - Frontend: 事件路由单测（`thread/compacting` / `thread/compacted`）与引擎边界测试。
   - 手工回归：Claude 长会话触发恢复；其他引擎行为不变。

4. 回滚策略
   - 若线上出现异常，关闭 Claude 自动恢复入口（保留原始失败路径）。
   - 事件映射可独立回滚，不影响既有会话主流程。

## Open Questions

- `Prompt is too long` 判定是否需要覆盖 provider/gateway 返回的更多同义错误文本？
- “轻量提示”是否默认开启，还是挂在设置开关下默认关闭？
- 自动 `/compact` 执行失败时，是否追加一条用户可见的 compact 失败提示（除 turn error 外）？
