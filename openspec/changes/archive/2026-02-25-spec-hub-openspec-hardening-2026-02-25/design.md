## Context

Spec Hub 已具备 OpenSpec MVP 闭环（change 浏览、artifact 读取、action 执行、gate/doctor/timeline 展示），但当前运行态仍存在会话耦合和证据一致性问题：

- 归档门禁依赖会话内 verify 时间线，刷新/切换后容易丢失“已验证”事实。
- artifact 读取的 `truncated` 仅作为字段存在，未进入门禁语义，存在假阳性风险。
- change 排序依赖命名约定（日期前缀），命名一旦偏离即出现顺序漂移。
- 测试覆盖集中在 runtime，hook/UI/bridge 的关键正向路径回归保护不足。

本设计希望以“事实驱动门禁 + 可见风险 + 稳定排序 + 测试补强”提升长期可维护性。

## Goals / Non-Goals

**Goals:**

- 将 verify 门禁依据从“会话内存”升级为“可持久/可复算事实”。
- 将 `truncated` 风险显式化并纳入 gate 语义。
- 将 change 排序切换到稳定元数据来源。
- 补齐 Spec Hub 高风险链路测试，降低回归漏检概率。

**Non-Goals:**

- 不扩展新 provider（例如 spec-kit 全量执行）。
- 不变更 OpenSpec CLI 协议。
- 不重做 Spec Hub 整体信息架构。

## Decisions

### Decision 1: Verify 采用“事实优先，缓存辅助”模型

- 方案 A：仅使用 timeline（现状）
    - 优点：实现最简单。
    - 缺点：会话丢失后门禁失真。
- 方案 B：仅本地持久化 verify 结果
    - 优点：实现成本较低。
    - 缺点：跨端一致性弱，仍是客户端真相。
- 方案 C（采用）：可复算事实为主 + 本地缓存为辅
    - 做法：将 verify 结果持久到 change 级证据（或可探测状态），gate 读取持久证据；timeline 仅用于展示最近操作。
    - 取舍理由：在一致性与实现复杂度之间取得平衡，优先保证门禁可信。

### Decision 2: `truncated` 风险进入门禁模型

- 对 `tasks/specs` 读取截断设置风险标记。
- gate 至少降级为 `warn`，并给出明确修复建议（重新读取、切换 spec root、补齐文件）。
- 保留当前 artifact 内容展示，但明确“非完整证据”状态，防止误判。

### Decision 3: 排序从命名耦合迁移到元数据

- 以文件元数据时间戳（或等价可追踪更新时间）作为主排序键。
- `changeId` 仅作为稳定 tie-breaker，不再承担时间真相职责。

### Decision 4: 测试矩阵按“故障最短路径”补齐

- hook：`specRoot/mode/refresh` 对 gate 的联动。
- component：action 可用性、gate/doctor 文案分支、timeline 回显。
- bridge：external spec list/read/write 的 invoke 参数映射。
- session linking：`visible` 正向场景与 rebind 成功场景。

## Risks / Trade-offs

- [Risk] 持久化 verify 事实与 timeline 展示可能短暂不一致 → Mitigation: 以持久证据为门禁唯一来源，timeline 明确标记“最近执行记录”。
- [Risk] `truncated` 提示过于频繁影响体验 → Mitigation: 仅对关键 artifact 触发 gate 降级，其余作为轻提示。
- [Risk] 文件时间戳在跨平台上语义差异 → Mitigation: 约定统一读取策略并在排序冲突时回退 `changeId` 次序。
- [Risk] 测试增量带来维护成本 → Mitigation: 聚焦高风险回归路径，避免过度 UI 快照测试。

## Migration Plan

1. 在 runtime 增加 verify 持久证据读取层与 gate 改造。
2. 在 artifact 汇总中提升 `truncated` 风险并接入 gate/doctor。
3. 替换 change 排序键并保留兼容 tie-break。
4. 补齐 hook/component/bridge/session-linking 回归测试。
5. 运行 typecheck/test 并人工回归 `verify -> archive`、`/spec-root` 正向链路。

回滚策略：

- 保留旧 gate 计算分支开关（必要时临时回退到 timeline 模式）。
- 排序逻辑可快速回退到旧实现，不影响 artifact 文件数据。

## Open Questions

- verify 持久证据应优先写入何处（变更目录文件、会话存储、或 CLI 探测接口）？
- 在多并发窗口下，verify 证据冲突的最终一致策略是什么？
- `truncated` 阈值是否需要按 artifact 类型配置化？
