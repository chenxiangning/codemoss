## Context

Kanban 的执行入口原本只有 `autoStart` 与拖拽到 `inprogress` 两条路径。随着“周期调度 + 串联续跑”持续迭代，触发源已经扩展为 `manual / drag / autoStart / scheduled / chained`，并且需要在不重写线程系统的前提下保持行为一致。

当前实现仍然以现有 thread lifecycle 为基础：

- 任务执行通过统一入口创建/复用 thread 并发送首条消息；
- processing 状态由 `threadStatusById` 驱动；
- 任务列状态保持 `todo / inprogress / testing / done`，不引入新状态机。

约束保持不变：

- 新字段必须 additive（旧任务零迁移可读）；
- 调度仅覆盖应用运行期，不做离线补跑；
- 串联仅支持线性链，避免图编排复杂度；
- 自动触发不得抢占用户当前会话焦点。

## Goals / Non-Goals

**Goals**

- 为 `todo` 任务提供 once/recurring 可治理调度，并具备暂停/恢复能力。
- 为线性链路 `A -> B -> C` 提供稳定自动续跑，且可解释阻断原因。
- 让调度任务与串联任务在看板中可识别、可分组、可排序。
- 保持普通任务行为兼容，不因新增能力回归。

**Non-Goals**

- 不实现后台常驻调度服务、离线补偿、系统级 cron。
- 不实现 DAG、并行分叉、条件分支、失败补偿引擎。
- 不传递完整会话历史，仅传递结构化结果快照。
- 不重写底层线程存储与消息协议。

## Decisions

### Decision 1: 执行入口统一收口到同一 orchestration 函数

- 选择：所有触发源统一进入 `launchKanbanTaskExecution(...)`。
- 原因：避免 `autoStart`、拖拽、调度、串联四套执行分叉；统一 lock、blocked reason、thread/model 选择与消息注入逻辑。

### Decision 2: 调度模型保持 additive，并显式记录运行治理字段

- 选择：在 `schedule` 中统一承载 `mode/nextRunAt/lastTriggeredAt/lastTriggerSource`，并扩展 `paused/pausedRemainingMs/overdue` 与 recurring 执行配置（`recurringExecutionMode/newThreadResultMode/maxRounds/completedRounds/seriesId`）。
- 原因：调度扫描只依赖持久化状态即可运行；支持暂停冻结倒计时与同会话轮次治理。

### Decision 3: 周期任务采用“完成后推进下一周期”语义

- 选择：recurring 在执行完成（离开 processing）后更新下一次周期，而非触发后立刻再排。
- 原因：避免周期任务在同一窗口连续触发，满足“执行成功后再计算下次执行周期”的用户语义。

### Decision 4: recurring 分为 same_thread/new_thread 两种策略

- `same_thread`：任务实体保持同一张卡片循环执行，可配置最大轮次并自动终止。
- `new_thread`：每次触发用新会话执行；完成后保留历史实例并生成下一次待办调度实例。
- 原因：分别覆盖“长期持续对话”与“每轮隔离会话”两类真实场景。

### Decision 5: pause/resume 采用剩余时长冻结策略

- 选择：暂停时记录 `pausedRemainingMs` 并停止倒计时；恢复时以“当前时间 + 剩余时长”重建 `nextRunAt`。
- 原因：行为直观、可预测，且不会因系统时钟或切列导致误触发。

### Decision 6: 串联模型严格保持线性链，并限制入口为链头

- 选择：每个节点最多一个上游；非链头任务禁止手动/拖拽单独执行，只允许 `source="chained"` 自动触发。
- 原因：避免链内乱序执行和双触发源冲突；保证串联语义可解释。

### Decision 7: 链路与分组拖拽增加结构保护

- 选择：禁止将非关联任务拖入关联组内部槽位；组内按链路顺序自动排序。
- 原因：保持“视觉分组”和“数据链路”一致，防止用户误操作破坏结构。

### Decision 8: 上游结果传递基于快照，而非完整 transcript

- 选择：从线程 items 提取结构化快照（summary + artifact paths + sourceThreadId），下游自动触发时前缀注入。
- 原因：上下文更紧凑、可控、跨引擎兼容性更好。

### Decision 9: 关联组引入组码与序号元数据

- 选择：链路 group 具备 3 位组码（新建随机；旧数据回退稳定码），组内任务显示串行序号。
- 原因：任务多时可快速识别组归属与执行顺序。

### Decision 10: 执行时标记录遵循 processing 边界

- 选择：进入执行写入 `startedAt`，离开执行写入 `finishedAt`，并在 `testing/done` 展示。
- 原因：保证审查与回溯数据可信，避免开始/结束时间同点写入失真。

### Decision 11: blocked reason 作为一等治理信号

- 选择：对调度冲突、链路非法触发、拖拽违规等都写入标准化阻断原因 key，并做 i18n 映射展示。
- 原因：减少“看起来没执行但不知道为何”的不可解释状态。

## Risks / Trade-offs

- [Risk] 同时存在调度扫描与 thread 状态更新，存在竞态窗口。  
  Mitigation：执行锁 + source 追踪 + 非重入阻断。
- [Risk] new_thread recurring 会增加卡片数量。  
  Mitigation：按 series/group 折叠分组，保留可读元信息（组码、轮次、时间）。
- [Risk] 串联限制（仅链头可手动触发）可能降低灵活性。  
  Mitigation：在菜单与阻断信息中明确提示，支持编辑链路后再执行。

## Migration / Rollback

Migration：

1. additive 字段扩展（types + storage normalize）；
2. 统一执行入口替换旧分叉路径；
3. 加入调度扫描与 recurring 完成后续排逻辑；
4. 加入串联门禁、拖拽约束、分组元数据与 UI 标签增强；
5. 回归测试与 strict validate。

Rollback：

- 可先关闭调度/串联入口和自动触发钩子；
- 因字段为 optional additive，旧任务仍可按普通任务读取；
- UI 回退不会阻断已有任务数据加载。

## Open Questions

- 暂无阻塞当前能力范围的开放问题；后续若要进入 DAG 或离线补跑，需新建 change 单独评估。
