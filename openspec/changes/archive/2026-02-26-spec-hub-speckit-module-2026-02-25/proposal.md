## Why

`/ai-reach:auto` 在 spec-kit 场景下仍缺少稳定连招编排：动作路由不透明、阶段反馈不完整、失败降级不一致，用户难以判断“是否真的执行、为何失败、下一步做什么”。
本提案聚焦 spec-kit，把 `auto` 从“单步触发”升级为“可解释、可恢复、可追溯”的连招引擎。

## 目标与边界

- 目标：为 spec-kit 建立 `/ai-reach:auto` 连招状态机（preflight -> route -> execute -> task-writeback -> finalize）。
- 目标：按动作独立决策执行来源（`native`/`ai`/`passthrough`/`blocked`），避免 provider 级粗粒度判断。
- 目标：统一失败恢复链路（`native -> guided(ai) -> passthrough`），并显式展示降级原因。
- 目标：在执行台中可视化 tier、source、阶段进度、结果摘要与下一步建议。
- 目标：在同一 workspace 同时存在 OpenSpec 与 spec-kit 时，保持前后端 provider 模块隔离，避免状态和执行互相污染。
- 目标：同一 auto 连招在 macOS 与 Windows 保持一致行为语义（路径解析、命令调用、错误分类、回退策略一致）。
- 目标：新增能力以独立模块落地，优先通过 adapter 扩展，不侵入或重写既有 OpenSpec 主链路代码。
- 边界：仅覆盖 spec-kit provider，不扩展其他 provider。
- 边界：不改上游 spec-kit 协议，只做 CodeMoss 编排与交互层优化。
- 边界：不引入针对单一操作系统的硬编码分支（如固定 shell/路径分隔符），所有平台差异通过统一 platform adapter 收敛。

## 非目标

- 不在本次实现跨 workspace 共享连招策略。
- 不在本次引入多 spec root 聚合执行。
- 不在本次开启自动归档；归档仍受显式门禁控制。

## 基于代码现状的可执行性结论（2026-02-26）

### 可直接复用的现有能力

- 已有 provider-scope 隔离骨架：`useSpecHub` 已按 `workspaceId:provider` 分隔 timeline 与 apply run state。
- 已有执行阶段反馈基础：`apply` 已落 `preflight -> instructions -> execution -> task-writeback -> finalize`。
- 已有任务回写守卫：仅解析显式 completed task 证据时回写，且包含回写失败保护分支。
- 已有 Spec Hub 浮层反馈组件能力：proposal/continue/verify/apply/auto-combo/ai-takeover 均可复用。

### 当前主要缺口（按代码实况）

- 模块边界仍未完成：spec-kit auto 逻辑尚未抽离到 `providers/speckit/**` 独立目录。
- platform adapter 尚未建立：macOS/Windows 的 command/path/error 语义仍未统一收敛。
- provider 隔离尚有缺口：doctor/gate 映射尚未完成 provider-scope 级隔离与回归验证。
- adapter ingress 强校验未完成：后端路由层尚缺 provider mismatch fail-fast 与 registry 级隔离。
- auto 五阶段与 route 层联动仍不完整：`route` 阶段状态与 doctor 联动降级提示需要继续补齐。

### 可执行性评级

- 方向可行：高。
- 当前阶段（Milestone A）可执行性：已落地并通过质量门禁。
- 下一阶段（Milestone B）可执行性：中高；建议按“模块抽离 -> provider 路由隔离 -> 平台抽象 -> 回归矩阵”顺序推进。

## 优化后的实施边界（Rebaseline）

### Milestone A（本变更必须完成）

- 在不破坏现有 OpenSpec 主链路前提下，为 spec-kit 引入 action-level strategy 数据模型（先可配置，后演进）。
- Spec Hub Actions 区可见 tier/source（至少 `minimal/guided`），并显示 blocked reason。
- 记录结构化 fallback 事件到 timeline（from/to/reason），禁止 silent fallback。
- provider-scope 隔离继续强化：spec-kit run state/timeline 不得影响 OpenSpec scope。

### Milestone B（后续变更承接）

- 抽离 `providers/speckit/**` 与 `providers/shared/platform/**`，完成模块边界硬隔离。
- 完成 macOS/Windows 的 command/path/error 统一 adapter 与错误归一。
- 补齐 bridge tier 与完整 fallback policy 自动降级链。

## 当前进度快照（2026-02-26）

- 已完成：Milestone A（A1-A8 全部完成，包含 runtime/hook/ui 测试与 typecheck/lint 门禁）。
- 未完成：Milestone B（B1-B4 未开始）。
- 代码侧已可见能力：
    - `SpecHubAction` 已包含 `source/sourceReason/fallbackChain`。
    - runtime 已生成 spec-kit action strategy matrix（continue/apply/verify/archive）。
    - hook 已写入结构化 fallback timeline 事件（`from -> to (reason)`）。
    - Spec Hub UI 已显示 tier/source、fallback trace 与 next-step CTA。

## 下一步干什么（建议执行顺序）

1. B1：抽离 `providers/speckit/**`，把现有 spec-kit route/strategy/fallback 从 `spec-core/runtime.ts` 拆到独立模块。
2. B2：建立 `providers/shared/platform/**`，先收敛 command/path normalize 与 error category。
3. B3：补 provider ingress 强校验 + adapter registry 隔离（防跨 provider 调度）。
4. B4：补回归矩阵（coexistence + macOS/Windows 语义一致性），完成 Milestone B 收口。

## What Changes

- 新增 `spec-hub-adapter-speckit`：
    - 承载 `/ai-reach:auto` 的 spec-kit 连招路由器。
    - 输出统一执行 envelope：阶段、来源、状态、摘要、错误、恢复建议。
  - 内置 platform adapter：统一抽象 macOS/Windows 的命令拼装、路径规范化与错误码归一。
- 新增前后端 provider 隔离约束：
    - 前端：OpenSpec 与 spec-kit 拥有独立运行态上下文和视图状态键，不共享 action run state。
    - 后端：OpenSpec adapter 与 spec-kit adapter 独立注册与独立路由，不允许跨 provider 调度。
- 新增独立模块边界约束：
    - spec-kit auto 逻辑在独立目录与入口下实现，通过稳定接口接入 runtime，不直接改写 legacy OpenSpec 分支逻辑。
    - legacy 代码仅允许最小接线改动（wiring），禁止在旧流程中混入 spec-kit 专属分支判断。
- 升级 `spec-hub-speckit-minimal-hook`：
    - 从单一 minimal 升级为 tier 化能力：`minimal`/`guided`/`bridge`。
    - 每个 tier 对应明确动作边界与升级提示。
- 升级 `spec-hub-runtime-state`：
    - 生成 action 级策略矩阵（每动作 source 与 blocker）。
    - 持久化最近一次 auto 连招运行态与结果摘要。
- 升级 `spec-hub-workbench-ui`：
    - Actions 区新增 Strategy Strip、Action Source Tag、Phase Feedback Card。
    - 失败后给出可操作恢复：重试/切换来源/手工 passthrough。
- 升级 `spec-hub-environment-doctor`：
    - 纳入 spec-kit 连招准备度检查（bridge 命令可达、策略配置合法、路径权限）。
    - 失败时分层降级，而非统一禁用。

## 技术方案对比与取舍

| 方案             | 描述                                      | 优点             | 风险                |
|----------------|-----------------------------------------|----------------|-------------------|
| A. 保持现状        | 继续 minimal + passthrough                | 成本低            | auto 连招价值不足，执行不可信 |
| B. 强做全量 native | 所有动作默认 native                           | 交互统一           | 兼容风险高，失败恢复复杂      |
| C. 分层连招（采用）    | tier + action strategy + fallback chain | 可控演进、反馈清晰、恢复稳定 | 需要维护策略矩阵与测试       |

取舍结论：采用 C，以 `/ai-reach:auto` 为入口，先保证 spec-kit 场景“能执行、看得懂、能恢复”。

## Capabilities

### New Capabilities

- `spec-hub-adapter-speckit`: spec-kit `/ai-reach:auto` 连招路由与结果结构化能力。

### Modified Capabilities

- `spec-hub-speckit-minimal-hook`: 升级为 tier 化能力与边界披露。
- `spec-hub-runtime-state`: 增加 action strategy matrix 与 run state 持久化。
- `spec-hub-workbench-ui`: 增加连招可视化反馈与恢复动作。
- `spec-hub-environment-doctor`: 增加 spec-kit 连招准备度诊断与降级规则。

## 验收标准

1. spec-kit workspace SHALL 显示当前 tier（`minimal`/`guided`/`bridge`）及边界说明。
2. Actions 面板 SHALL 为每个动作显示 source（`native`/`ai`/`passthrough`/`blocked`）与原因。
3. `/ai-reach:auto` 触发后 300ms 内 SHALL 显示 running 态与当前阶段。
4. `native` 失败时系统 SHALL 按策略降级到 `ai` 或 `passthrough`，并展示降级原因。
5. 任一连招完成后 SHALL 显示结构化结果（success/failed/no-change）与下一步建议。
6. 仅当输出包含显式 completed tasks 时 SHALL 回写任务；不明确时不得自动勾选。
7. Doctor SHALL 给出 spec-kit 连招准备度诊断与修复建议，并驱动 gate 状态一致变化。
8. runtime 刷新后 SHALL 保留最近一次连招摘要、source 与终态，且与时间线一致。
9. 回归测试 SHALL 覆盖 tier 判定、动作路由、降级链路、反馈卡、writeback 回滚。
10. 当同一 workspace 同时检测到 OpenSpec 与 spec-kit 时，系统 SHALL 允许按 provider 维度切换上下文且互不污染。
11. spec-kit `/ai-reach:auto` 执行 SHALL 不得写入或修改 OpenSpec provider 的 runtime/timeline/action state。
12. OpenSpec provider 的动作执行 SHALL 不得读取 spec-kit auto 连招临时状态作为判定依据。
13. 在 macOS 与 Windows 上，同一 action 的 source 判定与 fallback 顺序 SHALL 保持一致，不得因平台差异改变策略语义。
14. native dispatch SHALL 使用统一 platform adapter 处理路径与命令，不得在业务流程中散落平台特判。
15. 新增 spec-kit auto 代码 SHALL 以独立模块组织，legacy OpenSpec 主流程仅允许接线式变更，不得引入耦合回归。
16. 跨平台路径、命令与权限异常 SHALL 归一为结构化错误类别，并在 UI/日志中给出可执行修复建议。

## Impact

- Frontend Runtime/Hook:
    - `src/features/spec/runtime.ts`
    - `src/features/spec/hooks/useSpecHub.ts`
- UI:
    - `src/features/spec/components/SpecHub.tsx`
- Adapter/Bridge:
    - `src/lib/spec-core/runtime.ts`
    - `src/services/tauri.ts`
  - `src/features/spec/providers/speckit/**`（新增独立模块目录）
  - `src/features/spec/providers/shared/platform/**`（新增跨平台抽象层）
- Tests:
    - `src/features/spec/runtime.test.ts`
    - `src/features/spec/hooks/useSpecHub.test.tsx`
    - `src/features/spec/components/SpecHub.test.tsx`
    - `src/services/tauri.test.ts`
  - `src/features/spec/providers/speckit/**/*.test.ts`（新增模块隔离与跨平台回归）
