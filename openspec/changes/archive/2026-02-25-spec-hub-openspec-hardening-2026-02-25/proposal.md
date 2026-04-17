# Proposal: Spec Hub OpenSpec Hardening

## Why

当前 Spec Hub 的 OpenSpec 路径已经具备 MVP 闭环，但在长期使用场景下存在一致性与可维护性风险：

- `verify` 通过状态依赖会话内时间线，页面重载、切换 workspace 或时间线截断后会丢失，归档门禁可能误降级。
- artifact 读取存在 `truncated` 场景，但当前门禁和状态推导未把“内容被截断”作为显式风险，可能产生“状态看起来通过，实际信息不完整”的假阳性。
- change 排序依赖 `changeId` 的日期前缀，手工命名或非日期前缀时会出现顺序失真。
- 测试覆盖以 runtime 为主，Spec Hub hook/UI 与 Tauri spec wrapper 的关键正向链路覆盖不足，回归保护不均衡。

这类问题短期不一定阻塞功能，但会在变更量增加后放大为“流程可信度下降”。本提案目标是把 Spec Hub 从“可用”提升到“可持续可靠”。

## 目标与边界

- 目标：建立会话无关的 verify 真相源，使归档门禁不依赖短生命周期内存状态。
- 目标：将 artifact `truncated` 场景纳入门禁与可见性提示，避免静默假阳性。
- 目标：将 change 排序改为稳定元数据来源，弱化命名约定耦合。
- 目标：补齐 Spec Hub 高风险链路的自动化测试（hook/UI/bridge）。
- 边界：本提案聚焦 Spec Hub OpenSpec 完善，不扩展新 provider 功能。
- 边界：不重构现有 Spec Hub 信息架构与主交互布局。

## 非目标

- 不新增 OpenSpec CLI 能力或修改上游 CLI 协议。
- 不引入跨仓库联邦 spec 管理能力。
- 不在本次提案中重做整套 Spec Hub 视觉设计。

## What Changes

1. Verify 状态持久化与门禁重构
    - 增加 change 级验证状态存储/回读机制，或引入可复算的 verify 状态探测。
    - `archive` 门禁改为依赖持久化状态或可验证事实，而不是仅依赖当前会话 timeline。
2. Truncated 防误判机制
    - 在 artifact 读取阶段统一上报 `truncated` 风险位。
    - 对 `tasks/specs` 等关键文件引入门禁降级或显式 warning，并在 Gate/Doctor 可见。
3. Change 排序稳定化
    - 将排序依据从 `changeId` 日期前缀迁移到文件元数据或可追踪时间戳。
    - 保留旧命名兼容，但不再把命名格式作为唯一时间真相。
4. 测试矩阵补强
    - 增补 `useSpecHub` 关键状态迁移测试（refresh/specRoot/mode/gate 联动）。
    - 增补 `SpecHub` 关键交互测试（actions/gate/doctor/timeline 关键路径）。
    - 增补 Tauri spec wrapper（list/read/write external spec）映射测试。
    - 增补 `/spec-root` 探测正向可见链路测试（visible/rebind 成功路径）。

## 技术方案对比与取舍

### 方案 A：维持现状，仅补文档约束

- 优点：改动最小，交付快。
- 缺点：无法消除状态漂移和假阳性风险，问题继续累积。

### 方案 B：前端本地持久化（local store）+ 门禁增强

- 优点：实现成本低于后端改造，能快速缓解会话丢失问题。
- 缺点：状态真相仍在客户端，跨端一致性有限。

### 方案 C：以可复算事实为主（优先）+ 本地缓存为辅（采用）

- 优点：门禁依据更可信，跨会话一致性更高；本地缓存仅作为性能优化。
- 缺点：实现复杂度高于纯前端方案，需要补齐探测与错误处理。

取舍：采用 C。优先保证“可验证事实驱动门禁”，再通过缓存优化体验。

## Capabilities

### New Capabilities

- `spec-hub-verify-state-persistence`: verify 状态持久化/复算能力。
- `spec-hub-truncated-risk-guard`: artifact 截断风险识别与门禁联动能力。
- `spec-hub-stable-change-ordering`: 稳定排序能力（不依赖命名约定）。

### Modified Capabilities

- `spec-hub-runtime-state`: gate 计算规则升级为事实驱动。
- `spec-hub-workbench-ui`: gate/doctor 增加截断风险提示与恢复指引。
- `spec-hub-session-spec-linking`: `/spec-root` 正向可见链路测试与回归保护增强。

## 验收标准

1. 在 `verify` 执行成功后，刷新页面、切换 workspace 再切回，`archive` 门禁仍能识别“已通过验证”。
2. 当 `tasks.md` 或 `specs` 任一读取被截断时，Gate 至少降级为 `warn`，并展示明确风险提示。
3. change 列表排序在非日期前缀命名下仍稳定且可解释，不依赖 `changeId` 前 10 位。
4. `useSpecHub` 覆盖以下回归：`specRoot` 切换、`mode` 切换、refresh 竞态、gate 联动。
5. `SpecHub` 组件覆盖以下回归：核心 action 可用性、doctor 展示、gate 状态映射、timeline 关键事件。
6. `tauri.ts` 的 `listExternalSpecTree/readExternalSpecFile/writeExternalSpecFile` 均有 invoke 参数映射测试。
7. `/spec-root` 在可见结构场景下产出 `visible` 状态，且不展示误导性修复动作。

## Impact

- Frontend Runtime:
    - `src/features/spec/runtime.ts`
    - `src/features/spec/hooks/useSpecHub.ts`
    - `src/features/spec/components/SpecHub.tsx`
- Messaging/Session Link:
    - `src/features/threads/hooks/useThreadMessaging.ts`
- Tauri Bridge:
    - `src/services/tauri.ts`
- Tests:
    - `src/features/spec/runtime.test.ts`
    - `src/features/spec/hooks/useSpecHub.test.tsx`（新增）
    - `src/features/spec/components/SpecHub.test.tsx`（新增）
    - `src/features/threads/hooks/useThreadMessaging.test.tsx`
    - `src/services/tauri.test.ts`

