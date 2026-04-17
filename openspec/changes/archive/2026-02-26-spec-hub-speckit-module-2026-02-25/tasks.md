## 0. Rebaseline Plan（基于现状重排）

说明：以下清单是对现有任务的执行重排，优先保证“可见、可测、可回滚”，避免一次性做完 bridge + 跨平台 + 模块迁移导致交付失控。

### 0.1 Milestone A（本变更必须完成）

- [x] A1 [P0] 在 `SpecHubAction` 扩展 action-level strategy 字段（source/reason/fallbackQueue）。
- [x] A2 [P0] 在 runtime 生成 spec-kit action strategy matrix（至少覆盖 continue/apply/verify/archive）。
- [x] A3 [P0] 在 SpecHub Actions 面板展示 tier/source tag + blocker reason。
- [x] A4 [P0] 将 fallback 过程写入结构化 timeline 事件（from/to/reason）。
- [x] A5 [P0] 为 fallback trace 增加 UI 展示与 next-step CTA。
- [x] A6 [P0] 完成 provider-scope 隔离回归：spec-kit 与 OpenSpec timeline/run state 互不污染。
- [x] A7 [P0] 覆盖核心自动化测试：runtime/hook/ui（最小闭环）。
- [x] A8 [P0] 质量门禁：`vitest + typecheck + lint` 通过并附最小手工验收记录。
    - 验收记录（2026-02-26）：
      `npx vitest run src/features/spec/runtime.test.ts src/features/spec/hooks/useSpecHub.test.tsx src/features/spec/components/SpecHub.test.tsx`
      通过（87/87）；`npm run typecheck` 通过；`npm run lint` 通过（仅既有 hooks warnings，无 error）。

### 0.2 Milestone B（后续承接，不阻塞本变更）

- [ ] B1 [P1] 抽离 `src/features/spec/providers/speckit/**` 独立模块。
- [x] B2 [P1] 抽离 `src/features/spec/providers/shared/platform/**` 跨平台适配层。
- [x] B3 [P1] 完成 macOS/Windows command/path/error 归一与回归矩阵。
- [ ] B4 [P1] 将 bridge tier 全量能力迁入独立模块并补齐非回归保护。

### 0.3 下一步执行清单（结合代码现状）

- [x] N1 [P0] 启动 B1：新建 `src/features/spec/providers/speckit/**`，迁移 spec-kit strategy/route/fallback 逻辑。
    - 完成标准：`spec-core/runtime.ts` 仅保留 provider 分发与兼容接线；spec-kit 实现不再散落在 runtime/hook。
- [x] N2 [P0] 启动 10.5 + 10.6：adapter ingress provider 强校验 + registry 隔离。
    - 完成标准：spec-kit 请求不会触发 openspec handler；provider mismatch 明确 fail-fast。
- [x] N3 [P0] 启动 10.4：doctor/gate 按 provider-scope 隔离并补最小回归。
    - 完成标准：spec-kit 异常不会污染 openspec gate；双 provider 切换后状态一致。
- [x] N4 [P1] 启动 B2/B3：建立 `providers/shared/platform/**` 完成 macOS/Windows command/path/error 归一。
    - 完成标准：同一 action 的 source 判定与 fallback 顺序跨平台一致。

  进展记录（2026-02-26）：
    - N1 已完成：新增 `src/features/spec/providers/speckit/runtime.ts`，并迁移 spec-kit action command/args/source
      strategy/actions 组装，`spec-core/runtime.ts` 收敛为 provider 分发与接线。
    - N2 已完成：`runSpecAction` 增加 provider dispatch registry 与 unsupported provider fail-fast（含测试覆盖）。
    - N3 已完成：新增 provider 切换场景 gate 隔离回归测试，验证 openspec/speckit 来回切换 gate 不串线。
    - N4 已完成：新增 `providers/shared/platform/runtime.ts` 并接入 runtime/speckit，统一 fallback 顺序、customSpecRoot
      解析与跨平台错误归一；补 `runtime.test.ts` + `providers/shared/platform/runtime.test.ts` 覆盖 Windows/macOS 语义一致性。
    - 本轮验收：
      `npx vitest run src/features/spec/providers/shared/platform/runtime.test.ts src/features/spec/runtime.test.ts src/features/spec/hooks/useSpecHub.test.tsx src/features/spec/components/SpecHub.test.tsx`
      （94/94）通过；`npm run typecheck` 通过。

## 1. Auto Strategy Model and Tier Resolution

- [ ] 1.1 [P0][依赖:无] 定义 spec-kit auto 策略基础类型（输入: runtime action 模型；输出: `source/reason/fallbackChain`
  类型；验证: typecheck 通过）
- [ ] 1.2 [P0][依赖:1.1] 定义五阶段 run 类型（输入: auto 生命周期；输出: `preflight/route/execute/task-writeback/finalize`
  枚举；验证: 类型断言通过）
- [ ] 1.3 [P0][依赖:1.1] 定义终态类型（输入: 执行结果分类；输出: `success/failed/no_change`；验证: 终态映射单测通过）
- [ ] 1.4 [P0][依赖:1.1] 实现 tier 判定器（输入: marker + workspace config + doctor；输出: `minimal/guided/bridge`；验证:
  三类样例测试通过）
- [ ] 1.5 [P0][依赖:1.4] 输出 tier 来源字段（输入: 判定过程；输出: `marker/config/fallback`；验证: 来源断言通过）
- [ ] 1.6 [P0][依赖:1.4] 实现动作策略矩阵生成器（输入: tier + doctor + artifacts；输出: 4 动作 source；验证:
  continue/apply/verify/archive 覆盖）
- [ ] 1.7 [P0][依赖:1.6] 为策略矩阵补齐 blocker reason（输入: blocked 场景；输出: 可读原因；验证: blocker 文案断言通过）
- [ ] 1.8 [P0][依赖:1.6] 为策略矩阵补齐 fallback chain（输入: source 优先级规则；输出: `native->ai->passthrough` 链；验证:
  链路顺序断言通过）

## 2. Preflight and Route Phase

- [ ] 2.1 [P0][依赖:1.6] 实现 preflight 聚合器（输入: tier/doctor/artifacts/permissions；输出: preflight evidence；验证:
  evidence 快照测试通过）
- [ ] 2.2 [P0][依赖:2.1] 实现 preflight 阻断判定（输入: preflight evidence；输出: blocked/allow；验证: 阻断条件单测通过）
- [ ] 2.3 [P0][依赖:2.2] 实现 route 阶段 source 解析（输入: action + strategy matrix；输出: resolved source；验证: 四类
  source 断言通过）
- [ ] 2.4 [P0][依赖:2.3] 实现 blocked source fail-fast（输入: blocked source；输出: 不进入 execute；验证: dispatch 未被调用）
- [ ] 2.5 [P0][依赖:2.3] 在 route 结果中记录 fallback 候选（输入: strategy entry；输出: fallback queue；验证: queue 顺序正确）
- [ ] 2.6 [P1][依赖:2.4] 输出 route 阶段恢复建议（输入: blocker reason；输出: retry/switch/manual hint；验证: hint 分支测试通过）
- [ ] 2.7 [P1][依赖:2.2] 记录 preflight 与 route 时间戳（输入: phase 切换；输出: phase startedAt/endedAt；验证: 时间字段存在）
- [ ] 2.8 [P1][依赖:2.7] 计算 phase elapsed（输入: startedAt/endedAt；输出: 毫秒耗时；验证: elapsed 计算断言通过）

## 3. Execute Phase Routing (native / ai / passthrough)

- [ ] 3.1 [P0][依赖:2.3] 新建 spec-kit adapter dispatch 骨架（输入: resolved source；输出: source dispatcher；验证:
  三路函数可调用）
- [ ] 3.2 [P0][依赖:3.1] 实现 native dispatch（输入: bridge command mapping；输出: native 执行结果；验证: 成功/失败测试通过）
- [ ] 3.3 [P0][依赖:3.1] 实现 ai dispatch（输入: selected engine + action context；输出: ai 执行结果；验证: 三引擎路由断言通过）
- [ ] 3.4 [P0][依赖:3.1] 实现 passthrough dispatch（输入: passthrough entry；输出: 指令/跳转结果；验证: passthrough 结果断言通过）
- [ ] 3.5 [P0][依赖:3.2,3.3,3.4] 统一 dispatch 结果 envelope（输入: 三路原始输出；输出: 标准 `source+phase+status+summary`
  ；验证: 结构映射测试通过）
- [ ] 3.6 [P0][依赖:3.2] 实现 native fail -> ai fallback（输入: native fail；输出: 自动切换 ai；验证: fallback 发生且
  source 更新）
- [ ] 3.7 [P0][依赖:3.3,3.6] 实现 ai fail -> passthrough fallback（输入: ai fail；输出: 自动切换 passthrough；验证:
  fallback 发生且 source 更新）
- [ ] 3.8 [P1][依赖:3.6,3.7] 记录 fallback trace（输入: fallback event；输出: from/to/reason；验证: trace 结构断言通过）
- [ ] 3.9 [P1][依赖:3.8] 防止循环 fallback（输入: fallback queue；输出: 单次链路只降级不回跳；验证: 无循环断言）
- [ ] 3.10 [P1][依赖:3.5] 实现 no-change 终态识别（输入: 执行输出；输出: `no_change`；验证: no-change 分支测试通过）
- [ ] 3.11 [P1][依赖:3.5] 输出统一 next-step 建议（输入: terminal state；输出: retry/verify/manual 建议；验证: 三终态建议覆盖）

## 4. Task-Writeback Phase Guard

- [ ] 4.1 [P0][依赖:3.5] 定义显式完成项解析协议（输入: execution output；输出: completedTaskIndices；验证: 解析测试通过）
- [ ] 4.2 [P0][依赖:4.1] 实现 ambiguous 输出拦截（输入: 非显式完成项；输出: 空 writeback candidates；验证: 不发生误勾选）
- [ ] 4.3 [P0][依赖:4.1] 实现 writeback 执行器（输入: completedTaskIndices；输出: tasks.md 更新结果；验证: 落盘断言通过）
- [ ] 4.4 [P0][依赖:4.3] writeback 成功后刷新 task progress（输入: writeback success；输出: progress 更新；验证: 进度断言通过）
- [ ] 4.5 [P0][依赖:4.3] writeback 成功后刷新 gate（输入: writeback success；输出: action availability 更新；验证: gate
  断言通过）
- [ ] 4.6 [P1][依赖:4.3] 实现 writeback 失败回滚（输入: IO/权限失败；输出: optimistic state rollback；验证: 回滚断言通过）
- [ ] 4.7 [P1][依赖:4.6] 输出手工恢复提示（输入: rollback event；输出: manual update hint；验证: hint 显示断言通过）

## 5. Finalize, Timeline, and State Consistency

- [ ] 5.1 [P0][依赖:3.5,4.4,4.5] finalize 阶段刷新 runtime snapshot（输入: terminal result；输出: 最新 snapshot；验证:
  refresh 后状态一致）
- [ ] 5.2 [P0][依赖:5.1] 持久化最近一次 run 摘要（输入: terminal result；输出: lastRun summary/source/status；验证: refresh
  后可见）
- [ ] 5.3 [P0][依赖:3.8,5.1] 记录 timeline run 事件（输入: phase events + terminal state；输出: 时间线事件；验证: 事件字段断言通过）
- [ ] 5.4 [P1][依赖:3.8,5.3] 记录 timeline fallback 事件（输入: fallback trace；输出: 降级事件；验证: from/to/reason 可见）
- [ ] 5.5 [P1][依赖:5.2,5.3] 校验 actions 卡片与 timeline 一致性（输入: UI data sources；输出: 一致性断言；验证:
  action/timeline 对齐）
- [ ] 5.6 [P1][依赖:5.1] finalize 失败时暴露可重试状态（输入: refresh failure；输出: retryable finalize state；验证: retry
  分支测试通过）

## 6. Actions UI for /ai-reach:auto

- [ ] 6.1 [P0][依赖:1.4,1.6] 新增 Strategy Strip（输入: tier + strategy matrix；输出: 层级与来源摘要；验证: 三层展示正确）
- [ ] 6.2 [P0][依赖:1.6] 每动作渲染 Source Tag（输入: action source；输出: native/ai/passthrough/blocked tag；验证: 标签断言通过）
- [ ] 6.3 [P0][依赖:2.1,2.3] 渲染 preflight/route 状态（输入: phase run state；输出: 前两阶段状态可见；验证: 状态切换断言通过）
- [ ] 6.4 [P0][依赖:3.5,4.3,5.1] 渲染 execute/task-writeback/finalize 状态（输入: phase run state；输出:
  后三阶段状态可见；验证: 状态切换断言通过）
- [ ] 6.5 [P0][依赖:6.3,6.4] 保障 300ms 内 running 反馈（输入: action click；输出: loading/running 可见；验证: UI timing
  断言通过）
- [ ] 6.6 [P1][依赖:3.8,5.4] 渲染 fallback trace（输入: fallback event；输出: from->to+reason 可见；验证: trace UI 断言通过）
- [ ] 6.7 [P1][依赖:3.11] 失败与 no-change 场景渲染 next-step CTA（输入: terminal state；输出: retry/switch/manual
  按钮；验证: CTA 可见且可触发）
- [ ] 6.8 [P1][依赖:1.4] minimal 边界提示精细化（输入: minimal tier；输出: 明确不可执行说明；验证: 无误导执行按钮）

## 7. Doctor and Gate Alignment

- [ ] 7.1 [P0][依赖:1.4] 新增 spec-kit auto readiness 诊断模型（输入: tier + config + command + permission；输出:
  checks/hints；验证: 诊断结构断言通过）
- [ ] 7.2 [P0][依赖:7.1] 检查 bridge 命令可达（输入: native command map；输出: per-action availability；验证: 命令缺失断言通过）
- [ ] 7.3 [P0][依赖:7.1] 检查策略配置合法性（输入: strategy config；输出: config valid/invalid；验证: 配置异常断言通过）
- [ ] 7.4 [P0][依赖:7.1] 检查 spec 根目录读写权限（输入: path access；输出: permission state；验证: 权限异常断言通过）
- [ ] 7.5 [P0][依赖:7.2,7.3,7.4,1.6] 将 doctor 结果映射到 gate/source（输入: doctor checks；输出: source 降级或
  blocked；验证: gate/source 同步）
- [ ] 7.6 [P1][依赖:7.5,3.6,3.7] 显示降级原因与恢复建议（输入: downgrade event；输出: reason + remediation；验证: UI 可见）
- [ ] 7.7 [P1][依赖:7.5] 无可执行 source 时降级为 passthrough-only（输入: 全部高优先 source 不可用；输出:
  passthrough-only；验证: 策略断言通过）
- [ ] 7.8 [P1][依赖:7.7] passthrough-only 场景 gate 文案优化（输入: degraded gate；输出: 明确恢复路径；验证: 文案映射断言通过）

## 8. Automated Tests

- [ ] 8.1 [P0][依赖:1.1~1.8] 扩展 `runtime.test.ts` 覆盖策略模型（验证: tier/source/fallbackChain 断言通过）
- [ ] 8.2 [P0][依赖:2.1~2.5] 扩展 `runtime.test.ts` 覆盖 preflight/route（验证: blocked fail-fast 与 route 断言通过）
- [ ] 8.3 [P0][依赖:3.2~3.7] 扩展 `runtime.test.ts` 覆盖 dispatch 与 fallback（验证: native->ai->passthrough 断言通过）
- [ ] 8.4 [P1][依赖:3.8~3.10] 扩展 `runtime.test.ts` 覆盖 trace/no-change（验证: trace/no-change 断言通过）
- [ ] 8.5 [P0][依赖:4.1~4.5] 扩展 `runtime.test.ts` 覆盖 writeback 成功链（验证: progress/gate 更新）
- [ ] 8.6 [P1][依赖:4.6,4.7] 扩展 `runtime.test.ts` 覆盖 writeback 回滚链（验证: rollback/hint 断言通过）
- [ ] 8.7 [P0][依赖:5.1~5.3] 扩展 `useSpecHub.test.tsx` 覆盖 run state 持久与 timeline 追加（验证: 状态迁移断言通过）
- [ ] 8.8 [P1][依赖:5.4~5.6] 扩展 `useSpecHub.test.tsx` 覆盖 fallback/finalize failure（验证: retryable 状态断言通过）
- [ ] 8.9 [P0][依赖:6.1~6.5] 扩展 `SpecHub.test.tsx` 覆盖 Strategy Strip/Source Tag/五阶段反馈（验证: UI 断言通过）
- [ ] 8.10 [P1][依赖:6.6~6.8] 扩展 `SpecHub.test.tsx` 覆盖 fallback trace/CTA/minimal 边界文案（验证: UI 断言通过）
- [ ] 8.11 [P1][依赖:7.1~7.5] 扩展 `tauri.test.ts` 覆盖 bridge readiness 与 config 校验映射（验证: payload 精确匹配）
- [ ] 8.12 [P1][依赖:7.6~7.8] 扩展 `tauri.test.ts` 覆盖降级文案输入映射（验证: downgrade payload 断言通过）

## 9. Quality Gates and Manual Validation

- [ ] 9.1 [P0][依赖:8.1~8.12] 运行目标测试集（输入: runtime/hook/ui/tauri 测试；输出: 测试结果；验证: `vitest` 退出码 0）
- [ ] 9.2 [P0][依赖:9.1] 执行 `npm run typecheck`（输入: 全仓 TypeScript；输出: 类型检查结果；验证: 退出码 0）
- [ ] 9.3 [P0][依赖:9.2] 执行 `npm run lint`（输入: 目标模块；输出: lint 结果；验证: 退出码 0）
- [ ] 9.4 [P1][依赖:9.3] 手工回归 minimal/guided/bridge 三层连招（输入: 三类 workspace 样例；输出: 回归记录；验证: source
  与反馈一致）
- [ ] 9.5 [P1][依赖:9.4] 手工回归失败降级链与回写回滚（输入: native fail/ai fail/writeback fail 场景；输出: 验收记录；验证:
  无 silent fallback、无状态污染）

## 10. OpenSpec + Spec-kit Coexistence Isolation (Frontend / Backend)

- [x] 10.1 [P0][依赖:1.1] 定义 provider scope 键模型（输入: workspace + provider；输出: `workspaceId:provider` scope
  key；验证: key 生成单测通过）
- [x] 10.2 [P0][依赖:10.1,5.2] 将 run state 改为 provider-scope 存储（输入: auto run state；输出: 分 scope 状态容器；验证:
  双 provider 切换不串状态）
- [x] 10.3 [P0][依赖:10.1,5.3] 将 timeline 改为 provider-scope 存储（输入: phase/fallback events；输出: 分 scope
  时间线；验证: 事件不串线）
- [x] 10.4 [P0][依赖:10.1,7.5] 将 gate/doctor 映射改为 provider-scope（输入: diagnostics/checks；输出: 分 scope gate
  结果；验证: spec-kit 异常不污染 openspec gate）
- [x] 10.5 [P0][依赖:3.1] 在 adapter ingress 增加 provider 强校验（输入: action request provider；输出: mismatch
  fail-fast；验证: provider mismatch 测试通过）
- [x] 10.6 [P0][依赖:10.5] 分离 adapter registry（输入: openspec/speckit handlers；输出: 独立路由表；验证: spec-kit 请求不触发
  openspec handler）
- [x] 10.7 [P0][依赖:10.6,3.2,3.3] 增加跨 provider 写保护（输入: mutation request；输出: 仅当前 scope 可写；验证:
  cross-scope mutation 被拒绝）
- [x] 10.8 [P1][依赖:10.2,10.3,10.4] UI 增加 provider context 切换态保持（输入: context switch；输出: 两侧各自 last run
  恢复；验证: 切换前后 run summary 不覆盖）
- [x] 10.9 [P1][依赖:10.4,7.1] Doctor 面板分区展示（输入: coexistence diagnostics；输出: openspec/speckit 独立区块；验证:
  单侧异常仅影响本区块）
- [x] 10.10 [P1][依赖:10.5~10.9] 补 coexistence 回归测试（输入: 同 workspace 双 provider 样例；输出:
  runtime/hook/ui/adapter 回归；验证: 无跨 provider 污染断言通过）
    - 完成记录（2026-02-26）：`useSpecHub` 对 execute/apply/bootstrap/project/task 更新路径引入 provider-scope 写保护，异步回写仅在发起
      scope 仍活跃时落盘；Doctor 面板拆分 OpenSpec/Spec-kit 区块；新增跨 provider 延迟回写污染回归。
    - 本轮验收：
      `npx vitest run src/features/spec/hooks/useSpecHub.test.tsx src/features/spec/components/SpecHub.test.tsx src/features/spec/runtime.test.ts src/features/spec/providers/shared/platform/runtime.test.ts`
      （95/95）通过；`npm run typecheck` 通过；`npm run lint` 通过（仅既有 warnings，无 error）。

## 11. Cross-Platform Compatibility and Non-Intrusive Module Boundary

- [x] 11.1 [P0][依赖:3.1] 新建 platform adapter 抽象层（输入: macOS/Windows 差异；输出: 统一 command/path/error 接口；验证:
  接口单测通过）
- [x] 11.2 [P0][依赖:11.1,3.2] native dispatch 改为仅依赖 platform adapter（输入: action command map；输出: 平台无关
  dispatch；验证: 业务流程无平台特判）
- [x] 11.3 [P0][依赖:11.1,7.2] doctor 命令可达性检测兼容 macOS/Windows（输入: 平台命令解析；输出: 一致 readiness
  结果；验证: 双平台样例断言通过）
    - 完成记录（2026-02-26）：`runWorkspaceBinary` 统一经 platform adapter 归一错误（command/path/permission），新增 Windows
      “is not recognized” 诊断回归，Doctor detail 统一为 `command not found`。
- [x] 11.4 [P0][依赖:10.6] 将 spec-kit auto 落到独立模块目录并收敛入口（输入: 现有实现；输出: providers/speckit
  独立边界；验证: legacy 文件仅接线式改动）
    - 完成记录（2026-02-26）：`providers/shared/platform/runtime.ts` 提供 command/path/error 抽象（含测试）；
      `providers/speckit/runtime.ts` 承接 spec-kit command/strategy/fallback，`spec-core/runtime.ts` 收敛为 provider
      分发与接线。
- [x] 11.5 [P1][依赖:11.4] 为 legacy OpenSpec 主流程增加非回归保护（输入: 关键路径；输出: 无 spec-kit 分支侵入断言；验证:
  回归测试通过）
- [x] 11.6 [P1][依赖:11.2,11.3] 归一平台异常分类与修复提示（输入: path/permission/command error；输出:
  结构化错误码+hint；验证: UI 与日志映射断言通过）
- [x] 11.7 [P1][依赖:11.2,11.5] 扩展跨平台回归矩阵（输入: macOS/Windows 样例；输出: source/fallback 语义一致性报告；验证:
  两平台策略链断言一致）
    - 完成记录（2026-02-26）：OpenSpec action command args 与 command preview 收敛到 `providers/shared/platform`
      ；新增平台错误码到修复提示映射（command/path/permission），并接入 Doctor hints + UI 文案映射；新增 OpenSpec native-only
      fallback 非回归与 Windows/Posix 语义一致性回归。
    - 本轮验收：
      `npx vitest run src/features/spec/providers/shared/platform/runtime.test.ts src/features/spec/runtime.test.ts src/features/spec/hooks/useSpecHub.test.tsx src/features/spec/components/SpecHub.test.tsx`
      （100/100）通过；`npm run typecheck` 通过；`npm run lint` 通过（仅既有 warnings，无 error）。
