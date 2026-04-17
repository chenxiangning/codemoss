## 1. 调度与串联契约建模（P0，前置）

- [x] 1.1 [P0][depends: none] 扩展 Kanban 任务类型与存储模型（输出：optional 的 `schedule`、`chain`、`execution`、`lastResultSnapshot` 字段与兼容读取逻辑）。
- [x] 1.2 [P0][depends: 1.1] 实现调度规则与链路校验 utility（输出：合法性判断、下一次触发计算、循环/多分支拦截）。
- [x] 1.3 [P0][depends: 1.1] 定义统一执行上下文契约（输出：`source + lock + blockedReason + startedAt/finishedAt`）。

## 2. 统一执行编排与计划运行时（P0，依赖 1.x）

- [x] 2.1 [P0][depends: 1.3] 抽离共享 execution orchestrator，统一承接 `manual/drag/autoStart/scheduled/chained`。
- [x] 2.2 [P0][depends: 2.1,1.2] 增加应用内 scheduler 扫描与后台触发，不抢占当前 active thread。
- [x] 2.3 [P0][depends: 2.2] 落地 missed-run 与 non-reentrant 守卫（单次不补跑、周期仅未来窗口、运行中不重入）。

## 3. 连招结果提取与自动续跑（P0，依赖 1.x,2.x）

- [x] 3.1 [P0][depends: 1.2,2.1] 落地 todo-only 线性链建模与链路合法性校验。
- [x] 3.2 [P0][depends: 2.1] 从 `threadItemsByThread` 提取结果快照并持久化。
- [x] 3.3 [P0][depends: 3.1,3.2] 落地链式自动续跑与失败阻断（无快照/非法状态时阻断下游）。

## 4. 看板 UI 与交互集成（P1，依赖 1.x,3.x）

- [x] 4.1 [P1][depends: 1.2] 在任务创建/编辑弹窗接入 once/recurring 配置、执行方式与结果传递策略。
- [x] 4.2 [P1][depends: 3.1] 接入上游任务选择器与冲突提示（下游不可保留独立计划）。
- [x] 4.3 [P1][depends: 2.2,3.3] 在卡片/详情中展示调度、串联、阻断、执行时间等元信息。

## 5. 执行治理增强（P0，增量）

- [x] 5.1 [P0][depends: 2.2] 周期任务改为“执行完成后再计算下一周期”，避免同窗口重复触发。
- [x] 5.2 [P0][depends: 2.2] 支持调度暂停/恢复，并在暂停期间冻结倒计时标签。
- [x] 5.3 [P0][depends: 3.1,2.1] 增加“非链头禁止手动/拖拽单独执行”的统一门禁。
- [x] 5.4 [P0][depends: 3.1] 增加“非关联任务不可拖入关联组内部”的拖拽约束。
- [x] 5.5 [P0][depends: 3.1,4.3] 为关联组增加 3 位组码与组内串行序号展示（含旧数据回退策略）。

## 6. 视觉与可运维性收敛（P1，增量）

- [x] 6.1 [P1][depends: 4.3] 调度状态标签按列语义展示（调度器 / 执行中 / 已调度）。
- [x] 6.2 [P1][depends: 4.3] 审查区/完成区的周期新会话组与关联组支持折叠，并保持组内自动排序。
- [x] 6.3 [P1][depends: 4.3] 面板标签分类着色，去除无意义标签噪音，统一阻断原因文案映射。
- [x] 6.4 [P1][depends: 2.1,4.3] 进入执行写入开始时间、离开执行写入结束时间，并在审查/完成卡片展示。

## 7. 回归与门禁（P0，收尾）

- [x] 7.1 [P0][depends: 2.x,3.x,4.x,5.x,6.x] 补齐调度/串联/快照/存储单测与关键交互测试。
- [x] 7.2 [P0][depends: 7.1] 通过类型检查与目标测试：`pnpm tsc --noEmit`、`pnpm vitest run src/features/kanban src/app-shell-parts/useAppShellSections.kanban-text.test.ts`。
- [x] 7.3 [P0][depends: 7.1] 通过 OpenSpec 严格校验：`openspec validate add-kanban-scheduled-and-chained-tasks --strict`。
