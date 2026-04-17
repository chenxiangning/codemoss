## Context

用户会在客户端外（其他工具或手工）修改 Codex 配置文件。当前客户端运行期不会主动重新读取这些外部变更，导致“文件已改但客户端仍用旧配置”，必须重启后才生效。

同时，Codex 历史在不同 source/provider 下表现为分离可见，默认仅当前 source 数据可见。用户期望的是同一 workspace 的完整历史。

问题根因包含两层：
- 缺少 runtime 配置刷新入口
- 缺少跨 source 历史聚合读取模型

本设计目标：在不重启应用的前提下提供手动刷新能力，并将 Codex 历史默认切换为跨 source 聚合视图。

## Goals / Non-Goals

**Goals:**
- 提供客户端内显式“刷新 Codex 配置”入口。
- 刷新成功后下一次 Codex send 使用最新文件配置。
- Codex 历史列表默认聚合同一 workspace 的跨 source 会话。
- 聚合结果具备确定性去重、排序与 source 标签。
- 刷新失败时保持旧运行上下文可用。

**Non-Goals:**
- 不实现自动文件监听热更新（本期仅手动触发）。
- 不重构底层历史存储。
- 不改造 Claude/Gemini 生命周期链路。

## Decisions

### Decision 1: 首期采用“手动刷新按钮”，不做自动监听

- 方案 A（不采用）：继续要求用户重启。
- 方案 B（采用）：增加手动刷新入口，触发一次 runtime config reload。
- 方案 C（后续可选）：监听配置文件并自动刷新。

采用 B 的理由：
- 立即解决“必须重启才生效”核心痛点。
- 风险可控，避免监听抖动/半写入竞态。

### Decision 2: 历史视图默认改为跨 source 聚合（workspace 级）

- 读取模型由“当前 source 的 live thread/list 单源结果”扩展为“单源 live + 跨 source local 索引聚合”。
- 默认视图返回统一列表，不再按 source 隐式隔离。
- 每条记录携带 `source/provider` 元信息用于 UI 标签与后续筛选。

采用理由：
- 直接解决“切源后历史像丢失”的用户体感。
- 不改变底层数据落盘，仅改读取与展示层。

### Decision 3: 聚合结果使用确定性去重与排序

- 去重主键优先使用稳定 session/thread identity；冲突时按时间和来源优先级合并。
- 排序统一按更新时间降序，确保刷新前后顺序稳定。

采用理由：
- 避免聚合后重复项爆炸与列表抖动。
- 提升可预测性，便于测试与验收。

### Decision 4: 刷新流程 Fail-Safe + 串行化

- 状态机：`idle -> reloading -> applied | failed`。
- 重载关键区串行化，禁止并发重载覆盖。
- 任一阶段失败时，保留旧上下文并返回失败阶段/原因。

采用理由：
- 防止半应用状态。
- 保证用户可继续使用，降低故障影响。

## Proposed Flow

1. 用户在 Codex 设置区点击“刷新配置”。
2. 后端进入 reload 互斥区，读取并校验最新配置文件。
3. 成功时重建/替换 Codex runtime 上下文，并返回 `applied`。
4. 历史列表读取走“聚合器”：
   - 拉取当前 source 的 live thread/list
   - 读取 workspace 对应 sessions roots 的本地会话摘要（跨 source）
   - 合并、去重、排序后返回统一结果
5. 前端展示统一历史列表并带 source 标签。
6. 失败时返回 `failed`，旧上下文继续可用，历史列表不清空。

## Risks / Trade-offs

- [Risk] live 列表与 local 聚合条目语义不完全一致
  → Mitigation: 统一映射模型（id/title/updatedAt/source/localFallback），缺失字段做显式标记。

- [Risk] source identity 冲突导致错误去重
  → Mitigation: 去重键采用分层规则（threadId/sessionId/source），并增加冲突回归样例。

- [Risk] 刷新期间存在 in-flight turn
  → Mitigation: 重载关键区串行，必要时返回“稍后重试”而非强制中断执行中 turn。

- [Trade-off] 手动触发仍有一次操作成本
  → Mitigation: 首期优先稳定性，后续再评估自动监听。

## Migration Plan

1. 抽取启动期 Codex 配置读取/校验逻辑为可重入函数。
2. 新增运行时刷新命令入口（后端）并接入互斥控制。
3. 实现 Codex 历史聚合器（live + local、跨 source、去重排序）。
4. 设置页接入刷新按钮与状态反馈。
5. 补充回归测试：刷新生效、刷新失败、跨 source 历史全量、刷新前后连续性。

回滚策略：
- 关闭刷新入口并回退到“重启后生效”。
- 聚合器回退到现有单源列表逻辑。
- 无数据迁移，回滚成本低。

## Open Questions

- 聚合列表是否需要首期即支持 source 过滤切换（默认 all）？
- 对“仅存在本地摘要、远端不可见”的条目，是否在 UI 标注为 `local`？
- source/provider 标签命名是否直接复用 session_meta 字段值，还是做映射标准化？
