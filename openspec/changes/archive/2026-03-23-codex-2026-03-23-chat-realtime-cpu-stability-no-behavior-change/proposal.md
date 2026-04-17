## Why

当前客户端在“多个实时对话并发流式更新”场景下，CPU 使用率会出现明显尖峰（实测可到 160%+）。  
根因不是单点慢函数，而是高频 `delta` 事件触发了“多次 dispatch + 全量派生计算 + 多区域重复渲染”的叠加放大，且放大链路跨 `threads reducer`、消息区渲染、session activity/radar 聚合与调试事件序列化。

这已经影响交互稳定性（风扇噪音、掉帧、输入迟滞），且问题在多会话并发时可稳定复现。需要一个**不改变现有行为**的性能提案，优先消除瞬时 CPU 峰值与无效重算。

## 目标与边界

### 目标

- 在不改变用户可见行为的前提下，降低多实时会话场景的 CPU 尖峰与持续占用。
- 保持实时事件语义不变：不丢事件、不改顺序、不改最终消息内容。
- 把性能优化限定在客户端事件摄入、状态更新、派生计算与渲染链路。

### 边界

- 仅覆盖客户端实时会话链路（Codex/Claude/OpenCode 共用前端路径与会话派生层）。
- 不改后端协议字段，不引入 breaking API。
- 不改现有 UI 结构与交互语义（仅允许实现层优化和轻量可观测埋点）。

## 边界优先划分（Boundary First）

### In-Scope（必须改动）

- **事件摄入层**：`useAppServerEvents` 与 `useThreadItemEvents` 的高频事件入队、批处理与分发策略。
- **状态收敛层**：`useThreadsReducer` 的 no-op 短路、引用稳定性与无效更新屏蔽。
- **派生计算层**：`prepareThreadItems`、session activity/radar 的增量派生与缓存复用。
- **渲染消费层**：`Messages` 的重复 parse/重复 O(n) 计算收敛，确保单次更新最小计算路径。
- **可观测性层**：性能指标与回归基线采集（不改变业务语义）。

### Out-of-Scope（明确不做）

- 引擎协议语义改造（包括字段、事件种类、发送时机）。
- 历史数据模型迁移与持久化格式升级。
- UI 结构重排、视觉重构与交互逻辑重定义。
- 通过采样丢弃、截断事件、改变顺序来换取性能。

### Boundary Guard（边界守卫）

- 优化只允许发生在“实现层”，不得修改“契约层”：
  - 契约层：事件语义、生命周期终态、跨引擎可见行为。
  - 实现层：批处理策略、增量计算策略、memo/cache 策略。
- 任一优化若导致用户可见行为差异，必须回退到基线实现。

## 非目标

- 不做跨引擎协议重构。
- 不做消息时间线视觉改版。
- 不通过“丢帧/丢事件/降低精度”换性能。
- 不引入新的重量级状态管理框架。

## 技术方案对比

| 方案 | 描述 | 优点 | 风险/缺点 | 结论 |
|---|---|---|---|---|
| A. 维持现状，仅补局部小优化 | 只改 1-2 个热点函数 | 改动小 | 难覆盖放大链路，CPU 尖峰仍在 | 不推荐 |
| B. 无损实时链路降频 + 增量派生 + no-op 短路 | 事件按帧微批处理、reducer no-op 不换引用、只重算变更线程派生数据 | 能系统性降低重算与重渲染，行为可保持等价 | 需要补齐一致性测试与性能基准 | **推荐** |
| C. 后端采样/截断流式事件 | 从源头减少前端压力 | 降耗明显 | 有语义回退风险（事件粒度、顺序、可追溯性） | 不采用 |

## What Changes

- 增加实时事件“无损微批处理”层：将高频 `agentMessageDelta/reasoningDelta` 在短时间窗内合并提交，保持原顺序与完整性。
- 为 `threads reducer` 增加 no-op 短路规则（例如状态未变化时返回同一引用），减少无效 render 传播。
- 将 `prepareThreadItems` 与相关聚合派生改为“按受影响 thread 增量计算”，避免每次 `delta` 全量重算。
- 优化消息区渲染路径中重复 O(n) 与重复 parse 的计算位置，保证单次更新只做必要计算。
- 优化 session activity/radar 的刷新策略：从“全会话扫描”转为“变更线程驱动”的增量刷新。
- 收敛高频调试事件序列化开销（仅调试开启时执行重序列化/深对象写入），默认链路保持轻量。
- 增加性能观测点（事件吞吐、批处理队列长度、reducer no-op 命中率、渲染耗时），支持回归对比。

## 兼容性保证（Compatibility Contract）

- **协议兼容**：保持现有 AppServerEvent/Thread event 方法名与字段不变。
- **语义兼容**：保持消息顺序、终态、错误传播语义不变；不引入新的引擎分支行为。
- **数据兼容**：不变更 thread item 持久化结构，不引入迁移步骤。
- **引擎兼容**：Codex/Claude/OpenCode 均走同一优化约束，禁止只对单引擎改语义。
- **开关兼容**：支持按模块快速回退（事件批处理、增量派生、debug 优化可独立关闭）。

## 稳定性保证（Stability Contract）

- **有序性**：批处理前后事件相对顺序必须一致。
- **完整性**：不得丢失任何 `delta`、tool、lifecycle 事件。
- **幂等性**：重复到达或重放事件在状态层应可稳定收敛，不产生重复可见项。
- **收敛性**：processing -> completed/error 的生命周期终态必须可达且无悬挂。
- **隔离性**：某一 thread 的高频更新不得触发其他不相关 thread 的全量重算。
- **可回退性**：出现异常峰值或行为偏差时，可在不迁移数据的前提下恢复原路径。

## 验收标准

1. **行为等价（硬门槛）**
   - GIVEN 相同输入事件序列
   - WHEN 运行优化前后版本
   - THEN 最终消息内容、事件顺序、状态转移结果必须一致
   - AND 不允许出现消息缺失、重复或顺序错乱

2. **多会话 CPU 降峰**
   - GIVEN 3 个并发实时对话（含文本 delta、reasoning、tool 事件）
   - WHEN 连续运行 5 分钟
   - THEN 客户端进程平均 CPU 相对基线下降至少 30%
   - AND 峰值 CPU 相对基线下降至少 25%

3. **交互稳定性**
   - GIVEN 实时更新高压场景
   - WHEN 用户持续输入与滚动
   - THEN 输入响应与滚动流畅性不得低于基线
   - AND 不得出现明显主线程卡顿告警

4. **引擎边界不回退**
   - GIVEN Codex/Claude/OpenCode 任一线程
   - WHEN 发生实时事件
   - THEN 各引擎既有用户可见语义保持不变
   - AND 优化逻辑不得引入引擎特化回归

5. **兼容性硬约束**
   - GIVEN 现有前后端协议与历史会话数据
   - WHEN 升级到优化版本
   - THEN 不需要数据迁移、协议变更或用户手动修复
   - AND 原有自动化测试（含跨引擎生命周期）必须全部通过

6. **稳定性硬约束**
   - GIVEN 60 分钟持续实时压测（多线程并发 + 高频 delta）
   - WHEN 观察线程生命周期与消息完整性
   - THEN 不得出现 stuck processing、重复终态、消息丢失
   - AND 性能指标波动必须在基线阈值内（无异常退化）

## Capabilities

### New Capabilities

- `conversation-realtime-cpu-stability`: 在多实时会话并发下，提供无损事件微批处理、增量派生计算与低抖动渲染更新能力，确保行为等价下的 CPU 稳定性。

### Modified Capabilities

- `conversation-lifecycle-contract`: 增补“实时事件优化不得改变生命周期语义”的契约，要求 batching/coalescing 保持事件顺序、终态一致与跨引擎行为一致。

## Impact

- 主要影响前端模块：
  - `src/features/app/hooks/useAppServerEvents.ts`
  - `src/features/threads/hooks/useThreadItemEvents.ts`
  - `src/features/threads/hooks/useThreadsReducer.ts`
  - `src/utils/threadItems.ts`
  - `src/features/messages/components/Messages.tsx`
  - `src/features/session-activity/hooks/useSessionRadarFeed.ts`
  - `src/features/session-activity/hooks/useWorkspaceSessionActivity.ts`
  - `src/features/debug/hooks/useThreadRawEventDebugLog.ts`（若启用 debug 优化）
- 测试影响：
  - 需要新增“行为等价回放测试”与“多会话性能回归基准”。
  - 需要新增 reducer no-op 与增量派生正确性测试。
- 依赖影响：无新增外部依赖（优先复用现有工具链）。

## 风险与回滚

### 主要风险

- 批处理窗口设置不当导致“视觉延迟”升高。
- 增量派生缓存键设计不当导致旧数据污染。
- reducer no-op 条件过宽导致必要更新被短路。

### 风险缓解

- 对批处理窗口设置上限并提供压测校准数据。
- 对增量派生引入 thread/version 级失效策略与一致性测试。
- 对 no-op 条件提供白名单与差异快照校验。

### 回滚策略

- 分层回滚顺序：先关闭 batch，再关闭增量派生，最后回退 no-op 优化。
- 回滚不涉及数据迁移；回滚后恢复到原有实时处理路径。
