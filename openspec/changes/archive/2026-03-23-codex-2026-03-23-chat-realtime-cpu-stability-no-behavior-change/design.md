## Context

当前多实时会话场景的 CPU 峰值来自“高频事件 -> 多次 dispatch -> 全量派生 -> 多区域重渲染”的级联放大，而不是单点瓶颈。  
现有链路的关键问题：

- 高频 `agentMessageDelta/reasoningDelta` 事件逐条 dispatch，放大 reducer 与 selector 触发次数。
- `threads` 相关状态在 no-op 场景下仍返回新引用，导致无效渲染传播。
- `prepareThreadItems`、`Messages`、session activity/radar 聚合存在重复 O(n) 派生与重复 parse。
- debug 事件路径在高压场景有额外序列化与写入成本。

约束：

- 必须保持行为等价（事件顺序、终态、用户可见结果不变）。
- 必须优先做边界隔离（只动实现层，不动协议/语义契约层）。
- 必须可分层回滚（batch、增量派生、no-op 优化可独立关闭）。

## Goals / Non-Goals

**Goals:**

- 在多会话并发流式场景下显著降低 CPU 尖峰与持续占用。
- 建立“边界优先 + 兼容稳定性硬约束”的实现护栏。
- 通过性能观测与回放测试证明“降耗且不改行为”。

**Non-Goals:**

- 不改后端协议字段或事件模型。
- 不改 UI 信息架构与交互语义。
- 不通过事件丢弃、采样截断等方式换性能。
- 不引入新状态管理框架或大规模架构迁移。

## Decisions

### Decision 1: 采用无损微批处理替代逐条高频 dispatch

**选择**  
在事件摄入层按 thread 建立短窗口队列（帧级 flush），将高频 `delta` 合并后批量提交 reducer，保持原始相对顺序与完整性。

**原因**  
这是降低 dispatch 频次与 render 抖动的最低侵入点，且可保持行为等价。

**备选方案**

- 逐条处理 + 局部 memo：难消除事件风暴。
- 上游采样/截断：有行为回退风险，不满足“无损”目标。

### Decision 2: 在 reducer 引入严格 no-op 短路与引用稳定策略

**选择**  
仅当状态语义真实变化时才返回新对象；无变化时返回原引用，避免级联重渲染。

**原因**  
当前 CPU 放大包含大量“结果未变但引用变化”开销，no-op 短路是必要基础。

**备选方案**

- 仅在组件层做 `memo`：覆盖面不足，且容易遗漏深层派生。

### Decision 3: 派生计算改为 thread-scoped 增量更新

**选择**  
为 thread items、activity、radar 引入“变更 thread 驱动”的增量失效策略，不再每次全量重建全局派生数据。

**原因**  
多会话并发时，大量未变化 thread 不应重复计算。

**备选方案**

- 全局派生缓存 + 粗粒度失效：命中率低，容易退化到全量重算。

### Decision 4: 消息渲染中的重复 parse/重复 O(n) 计算前置收敛

**选择**  
将可复用的 parse/映射计算绑定到 item revision，仅在 revision 变化时重算；渲染阶段只消费结果。

**原因**  
渲染阶段重复 parse 在高频更新下放大明显，前置能稳定帧耗时。

**备选方案**

- 继续在渲染函数内临时计算：实现简单但抖动无法收敛。

### Decision 5: debug 重路径默认旁路，按开关启用

**选择**  
默认链路避免高频深序列化；仅在 debug 开启时执行重调试路径。

**原因**  
调试能力要保留，但不能成为线上默认性能负担。

**备选方案**

- 永久保留当前 debug 写入路径：会持续放大高压成本。

### Decision 6: 通过分层 feature flag 保障稳定上线与可回滚

**选择**  
将优化拆为独立开关：`realtimeBatching`、`incrementalDerivation`、`reducerNoopGuard`、`debugLightPath`。

**原因**  
问题定位与回滚必须可精确到层，避免“一刀切”回退全部优化。

**备选方案**

- 单一总开关：回滚粗糙，难以定位具体退化源。

## Risks / Trade-offs

- [批处理窗口过大导致感知延迟] -> 设定 flush 上限并做交互延迟回归测试。  
- [增量失效键错误导致旧数据污染] -> 引入 thread/version 双键与一致性快照校验。  
- [no-op 条件过宽短路必要更新] -> 增加差异断言与回放测试，异常时自动降级到保守路径。  
- [多层开关增加维护成本] -> 统一开关命名与日志埋点，提供默认推荐组合。

## Migration Plan

1. 建立基线  
   - 固化 3-thread 并发回放夹具与 5/60 分钟压测脚本，产出 CPU 与事件完整性基线。
2. 分层落地  
   - 先接入 `realtimeBatching`，再接 `reducerNoopGuard`，随后接 `incrementalDerivation` 与 `debugLightPath`。
3. 行为等价验证  
   - 对比优化前后事件序列、最终 thread items、lifecycle 终态，必须一致。
4. 稳定性验证  
   - 运行长时压测，检查 stuck processing、重复终态、消息缺失与帧抖动。
5. 发布与回滚  
   - 默认按推荐开关组合发布；异常时按“batch -> derivation -> noop”顺序分层关闭。

## Open Questions

- 微批处理 flush 上限应按平台（macOS/Windows）区分默认值，还是统一常量？
- 是否需要把关键性能指标接入现有运行日志面板，以支持线上快速定位？
- 在极端 burst 场景下，是否需要增加队列背压告警阈值（仅告警，不丢事件）？
