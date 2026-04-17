## Context

当前 `spec-hub-speckit-module-2026-02-25` 的核心诉求是：优化 spec-kit 场景下 `/ai-reach:auto` 的连招执行体验。
现状问题集中在三点：

- 路由不透明：用户不知道动作最终走 `native`、`ai` 还是 `passthrough`。
- 反馈不完整：点击后缺少阶段化反馈，容易误判“没执行”。
- 恢复不一致：失败后降级链路不稳定，存在 silent fallback 风险。

## Current-Code Baseline（2026-02-26）

- 已落地：
    - `useSpecHub` provider-scope 关键隔离（timeline/applyExecution 分 scope 保存与恢复）。
    - apply 执行五阶段中的核心链路（preflight/instructions/execution/task-writeback/finalize）。
    - Spec Hub 多类浮层反馈基础设施（可承载新 phase/source 可视化）。
    - `SpecHubAction` action-level strategy 字段（`source/sourceReason/fallbackChain`）。
    - runtime 的 spec-kit action strategy matrix（continue/apply/verify/archive）。
    - fallback 结构化 timeline 事件（`kind: fallback`, `from -> to (reason)`）。
    - Actions/Timeline 的 fallback trace + next-step CTA 展示。
- 未落地：
    - spec-kit 独立 adapter 目录边界（`providers/speckit/**`）与 registry 隔离。
    - provider ingress 强校验（mismatch fail-fast）与跨 provider 写保护。
    - doctor/gate 的 provider-scope 完整隔离与一致性回归。
    - 跨平台 platform adapter（macOS/Windows command/path/error 归一）。

结论：本设计可执行，但需要按“先 runtime/UX 闭环，后模块与平台抽象”的顺序推进。

## Goals / Non-Goals

**Goals**

- 建立 spec-kit 专用 auto 连招状态机。
- 建立动作级策略路由（而非 provider 级硬分支）。
- 建立统一失败恢复链路并可视化展示。
- 让 doctor/gate/runtime/UI 对同一连招事实保持一致。
- 确保同项目 OpenSpec 与 spec-kit 并存时，前后端模块和状态独立。

**Non-Goals**

- 不做 spec-kit 协议扩展。
- 不引入跨 workspace 的策略共享。
- 不改 Spec Hub 的整体三栏信息架构。

## Decisions

### Decision 1: `/ai-reach:auto` 采用动作级策略矩阵

每个动作独立决策 source：

- `native`
- `ai`
- `passthrough`
- `blocked`

这样能避免“同一 workspace 一刀切”的错误可用性判断。

### Decision 2: 连招统一五阶段状态机

固定阶段：

1. `preflight`
2. `route`
3. `execute`
4. `task-writeback`
5. `finalize`

每阶段都输出可视状态与摘要，禁止黑盒执行。

### Decision 3: Tier 决定上限，策略决定当次执行

- tier（`minimal/guided/bridge`）定义能力边界
- strategy 定义当前动作实际走哪条路径

这样既能做长期能力分层，也能处理短期环境波动。

### Decision 4: 失败恢复链路固定为有序降级

默认链路：

- `native` 失败 -> `ai`
- `ai` 失败 -> `passthrough`
- `passthrough` 无恢复能力 -> 明确阻断

禁止 silent fallback，必须在 UI 与 timeline 显示降级原因。

### Decision 5: Task writeback 继续保持“显式完成项优先”

只有在输出可映射为明确 task index 时才允许自动勾选；否则只给手工更新建议。

### Decision 6: 双 Provider 并存采用“上下文隔离 + 适配器隔离”

- 前端隔离：
    - runtime snapshot 按 `providerScope` 分区（`openspec`、`spec-kit`）
    - actions/timeline/run-state 使用 provider-scope key
    - UI 通过 provider 上下文切换，不复用对方 provider 的临时执行态
- 后端隔离：
    - `adapter-openspec` 与 `adapter-speckit` 独立入口与路由
    - 请求必须携带 `provider`，并在 dispatch 前强校验
    - 禁止 spec-kit auto 调 OpenSpec adapter，反之亦然

采用原因：并存是常态，隔离是稳定性的前提；不隔离会导致 action 判定和日志串线。

## Architecture Sketch

### Runtime Model (Pseudo)

- `specKitTier`: `minimal | guided | bridge`
- `actionStrategy[action]`: `{ source, reason, fallbackTo? }`
- `autoRunState`: `{ action, phase, status, source, summary, error, startedAt }`
- `providerScopeState`: `{ openspec: ScopeRuntimeState, speckit: ScopeRuntimeState }`

### Orchestration Flow (Pseudo)

1. preflight

- 读取 tier、doctor、artifact 风险、权限状态

2. route

- 解析 action strategy（含 fallback）

3. execute

- dispatch 到 `native | ai | passthrough`
- 记录阶段日志

4. task-writeback

- 仅消费 `completedTaskIndices`
- 失败回滚

5. finalize

- 刷新 runtime/gate/timeline
- 输出下一步建议

### Coexistence Isolation Rules (Pseudo)

1. request ingress

- 入参必须包含 `provider: 'openspec' | 'spec-kit'`
- provider 缺失或不匹配时直接 fail-fast

2. state mutation

- 仅允许写入当前 provider scope
- 跨 scope mutation 直接拒绝并记录诊断

3. ui binding

- Actions/Timeline/Guards 绑定当前 provider scope 数据源
- 切换 provider 时保留各自最近运行态，不互相覆盖

## Risks / Trade-offs

- 风险：策略配置错误导致误路由。  
  缓解：doctor 做配置合法性检查，route 阶段 fail-fast。

- 风险：降级过多影响用户预期。  
  缓解：每次降级强制展示“降级原因 + 当前 source + 推荐动作”。

- 风险：ai 路径不稳定。  
  缓解：保留 passthrough 兜底，且阶段化反馈可定位失败点。

- 风险：双 provider 并存时状态串线。  
  缓解：前端 provider-scope store + 后端 adapter 强校验 + 跨 scope 写保护。

## Migration Plan

1. P0

- 建立策略矩阵与 run state 模型
- 接入 auto 五阶段反馈卡
- 打通 `native/ai/passthrough` 统一 envelope

2. P1

- 完善 fallback 链路与 doctor 联动
- 增加 writeback 回滚与降级可见性
- 补齐测试矩阵

3. P1 手工验收

- minimal/guided/bridge 三种 workspace 分层回归
- 核对 timeline 与 actions 一致性

Rollback Strategy:

- 保留 `minimal-only` feature flag 回退路径。
- bridge 模式异常时自动回退 guided，保障可用性。

## Rebaseline Sequencing（优化顺序）

1. 先完成 Milestone A（runtime + UI + tests）

- 目标：在现有代码骨架上完成 spec-kit strategy/source/fallback trace 的可见可测闭环。
- 约束：不先做大规模目录迁移，不在此阶段引入跨平台命令执行复杂化。

2. 再完成 Milestone B（module split + platform adapter）

- 目标：将 Milestone A 的能力沉淀到独立模块边界，并完成 macOS/Windows 语义一致性收敛。
- 约束：需要额外变更承接，不与 Milestone A 并行混做。

## Next Step（建议直接执行）

1. 先做 `B1 + 10.6`：
    - 新增 `src/features/spec/providers/speckit/**`，
    - 把 spec-kit strategy/route/fallback 逻辑从 `src/lib/spec-core/runtime.ts` 迁入，
    - runtime 仅保留 provider 分发与兼容接线。
2. 再做 `10.5 + 10.7`：
    - 在 adapter ingress 校验 `provider`，
    - 禁止跨 provider mutation，并补 fail-fast 测试。
3. 然后做 `B2 + B3`：
    - 新增 `src/features/spec/providers/shared/platform/**`，
    - 统一 macOS/Windows command/path/error 语义，
    - 补最小双平台回归样例。

## Open Questions

1. `archive` 在 spec-kit 下是否默认跳过 native，直接 `ai/passthrough`？
2. bridge 配置落盘格式是否独立于现有 workspace settings？
3. tier 升级是否需要显式用户确认（防止误切到高风险路径）？
