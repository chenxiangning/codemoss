## Why

Native Provider Continuation 当前把 Context bootstrap 当作普通用户 Turn 执行，并把成功建立在模型精确回显 `MOSSX_CONTEXT_ACCEPTED` 上。生产验收已出现“首次报 `acceptance-ambiguous`、二次重试成功”、控制消息污染标题/幕布/processing，以及 Shared Session Turn 身份统一退化为 `codex · 本地配置`，说明 control plane、conversation plane 与 frozen execution snapshot 的边界仍未闭合。

## 目标与边界

- 让 Native Provider Continuation 首次执行可确定收口，重复请求保持幂等，已创建目标会话不得因模型未精确回显而被误判为失败。
- bootstrap 数据继续可持久化、恢复和审计，但不进入普通 transcript、reasoning、标题生成或用户 Turn 生命周期。
- 续接关系只以紧凑、默认折叠的 metadata 行进入现有 `.messages` 滚动容器；不修改普通消息排列、streaming、结束判定与 scroll anchor contract。
- Shared Session 每个 Turn 从 durable `TurnExecutionSnapshot` 展示真实 CLI、Provider Profile、Model；旧 Turn 不受当前 picker 变化影响。

## 非目标

- 不重构既有 Messages/Canvas 架构，不改变普通 Native/Shared 消息 DOM 结构。
- 不新增 Provider、不扩大 Kimi continuation target 能力。
- 不删除已有 continuation operation、Context artifact 或 vendor history。
- 不以延长等待时间或新增字符串过滤作为主要修复。

## What Changes

- Native bootstrap 使用结构化 control metadata 和 durable transport evidence；模型精确回显只作为兼容 evidence，不再是唯一成功条件。
- bootstrap 产生的 user/assistant/reasoning/runtime lifecycle 从普通 conversation projection 隔离，并保证 operation 与 processing 状态 terminal 收口。
- Continuation Dialog 使用可恢复状态和人类可读错误；已有目标会话时提供继续校验/打开目标，技术详情默认折叠。
- Continuation context 改为 `.messages` 内紧凑、可折叠 metadata 行，来源导航保持可达。
- Shared Turn attribution 补齐 picker → send → canonical fact → reload projection 的完整 frozen snapshot。
- 历史 protocol title 与缺少 Provider snapshot 的旧数据使用诚实 fallback，禁止伪造“本地配置”。

## 方案对比

1. **结构化 bootstrap + durable evidence（采用）**：从根因拆开 control/conversation plane；改动跨层但可测试、可恢复。
2. **增加 ACK 等待与重试（拒绝）**：仍依赖模型遵循 prompt，延迟更高且 duplicate side effect 风险不变。
3. **继续按 marker 文本过滤（拒绝）**：无法覆盖关联 reasoning、processing、title 与非精确模型回复。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `native-provider-continuation`: bootstrap acceptance、幂等恢复、Dialog recovery state 与最小幕布投影边界。
- `session-history-display-fidelity`: control-plane Turn 必须整体从普通 transcript/title 隔离，续接 metadata 使用紧凑折叠投影。
- `shared-execution-target`: frozen snapshot 必须贯通 Provider/CLI/Model display identity，缺失身份时不得伪造本地配置。
- `shared-canonical-projection`: reload projection 必须保留逐 Turn execution identity，不得用当前 target 覆盖历史。

## 验收标准

- Claude 未精确回显 marker 时，只要目标 Session 与 Context payload 已持久化，operation 可直接进入 `ready`，重复调用不创建第二个目标 Session。
- bootstrap prompt、assistant reply、reasoning、protocol marker 不出现在普通幕布、标题和运行状态；正常首条用户 Turn 可独立开始并正确结束。
- 续接 metadata 默认折叠且位于既有 `.messages` scroll flow；移除后普通幕布 DOM/layout 行为与改动前一致。
- Dialog 不展示裸 `acceptance-ambiguous` 作为主文案，并对可恢复状态提供明确下一步。
- Shared Session 连续使用两个 Provider 后，每个 Turn 在发送后与重启 reload 后都显示各自真实 CLI、Provider、Model，历史不随 picker 改写。
- 增量 frontend/Rust tests、typecheck、scoped lint 与 OpenSpec strict validation 通过。

## Impact

- Backend：`src-tauri/src/native_continuation/**`、continuation operation persistence/history probe。
- Frontend：Provider continuation Dialog/context projection、Messages metadata slot、Shared V2 send snapshot 与 badge projection。
- Contracts：Tauri payload mapping、OpenSpec delta、`dev-guidelines/backend` executable contracts。
- 性能：新增 projection 只订阅稳定 metadata，不接入 delta 高频根 hook；无新依赖、无 OS-specific path。
