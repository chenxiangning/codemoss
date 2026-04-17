# Proposal: Codemoss Spec Platform Integration (OpenSpec First, Spec-Kit Minimal Hook)

## Why

当前 CodeMoss 已经在用 OpenSpec 管理规范，但产品层面对规范的支持仍偏“文件视角”而非“工作流视角”：

- 用户需要在编辑器、终端、文档之间来回切换，规范与实现链路割裂。
- 缺少统一的 Spec Runtime，导致 OpenSpec 的执行闭环无法在产品内稳定承载。
- 新用户上手门槛高：环境依赖（Node/Python/uv/CLI）与命令体系分散。

这会导致三个直接问题：

1. 规范落地率低（写了 proposal/design，但未形成稳定执行闭环）。
2. 团队协作成本高（状态不可视、上下游交接依赖口头同步）。
3. 平台扩展受限（未来接入更多 spec 体系会重复造 UI/解析层）。

因此需要将“规范系统”升级为 CodeMoss 内的一等能力：可视化、可执行、可追踪。

## What Changes

本变更提议在 CodeMoss 引入统一的 Spec Platform，采用 `OpenSpec-first` 路线：先把 OpenSpec 做深做稳，同时为 spec-kit
预留最小兼容口子。

### 1) 架构层：统一 Spec Runtime + Adapter

- 新增统一接口层 `SpecAdapter`，优先服务 OpenSpec；spec-kit 仅挂载最小兼容入口。
- UI 只面向统一领域模型（Change / Artifact / Task / Validation）。
- 将 CLI 能力定位为“执行器”而非“唯一真相”，文件系统为最终状态源。

### 2) 产品层：Spec Hub 工作台

- 新增 `Spec Hub` 主入口，支持变更列表、状态筛选、详情查看与动作执行。
- 提供标准化流程动作：`Explore / New / Continue / Apply / Verify / Archive`。
- 将规范、关联代码提交、验证结果串成单条可回放时间线。
- UI 必须与现有 CodeMoss 设计系统高度统一（间距、层级、状态色、交互反馈）。
- 在列表、动作轨、时间线中采用 icon-first 信息编码，降低文本阅读成本。

### 3) 环境层：双模式安装策略

- **Managed 模式（默认推荐）**：CodeMoss 引导安装并托管 OpenSpec 运行依赖。
- **BYO 模式（高级用户）**：直接复用系统已有 `openspec` / `specify` 命令。
- 无论哪种模式，UI 行为一致，用户不需要理解内部细节。

### 4) 治理层：执行前置检查与门禁

- 执行动作前展示前置条件（例如无 `tasks.md` 不允许 `apply`）。
- 对高风险动作给出影响面提示（涉及哪些 specs、哪些模块可能受影响）。
- 验证结果结构化展示，支持一键定位失败项。

## Capabilities

### New Capabilities

- `spec-platform-runtime`
    - 统一的规范运行时模型与状态机。
    - 支持从文件系统实时重建 change 状态。

- `spec-platform-openspec-adapter`
    - OpenSpec 解析、校验、命令执行适配。
    - 支持 proposal/design/spec/tasks/verification 全链路。

- `spec-platform-speckit-hook`
    - spec-kit 项目识别与最小读取能力（read-only）。
    - 提供“跳转外部命令/文档”的兼容入口，不承诺首期完整动作适配。

- `spec-platform-environment-doctor`
    - 环境探测（Node/Python/uv/CLI 可用性、版本、路径）。
    - Managed/BYO 双模式切换与健康检查。

- `spec-platform-workbench-ui`
    - Spec Hub 可视化工作台（列表、详情、动作轨、时间线）。
    - 状态筛选：Draft / Ready / Implementing / Verified / Archived。
    - 与主系统视觉语言统一，并提供状态/动作/风险 icon 语义集。

### Modified Capabilities

- `codex-chat-canvas-plan-visibility`
    - 将“计划卡片”与 Spec Change 建立轻量关联，提升计划到实现的可追踪性。

## Product Decision: 安装与集成策略

### 选项对比

| 方案         | 描述                                    | 优点           | 风险                  |
|------------|---------------------------------------|--------------|---------------------|
| A. 用户独立安装  | 用户自行安装 OpenSpec/spec-kit 与依赖          | 实现最轻         | 上手门槛高，失败率高，支持成本高    |
| B. 全内置不暴露  | CodeMoss 内部打包全部能力，不暴露外部 CLI           | 体验统一         | 升级与兼容成本高，技术风险集中     |
| C. 双模式（推荐） | OpenSpec 默认引导安装（Managed）+ 支持系统复用（BYO） | 兼顾开箱体验与专家可控性 | 需定义 spec-kit 最小支持边界 |

**决策**：采用 `C. 双模式`。

理由：

1. 对新用户，开箱即用，显著降低失败路径。
2. 对高级用户，不破坏现有工具链和习惯。
3. 对平台演进，便于逐步内聚能力，不被单一路径锁死。

## UX Blueprint (Spec Hub)

### 信息架构

1. 左栏：`Changes`
    - 分组展示（Active/Blocked/Archived）。
    - 快速筛选（Owner、Status、Updated Time）。

2. 中栏：`Artifacts`
    - Tabs: `Proposal` / `Design` / `Specs` / `Tasks` / `Verification`。
    - 支持只读模式与编辑模式切换。

3. 右栏：`Action Rail`
    - 推荐下一步动作（含前置条件解释）。
    - 直接执行 `continue/apply/verify/archive`。

4. 底栏：`Trace Timeline`
    - 串联规范变更、代码提交、验证结果。
    - 支持按时间倒序审计回放。

### 交互原则

- 规范内容与代码上下文同屏可见，减少上下文切换。
- 所有“可执行动作”必须显式显示前置条件与影响范围。
- 错误信息必须可定位（命令、文件、失败原因三元组）。
- 视觉与交互节奏必须复用现有系统规范（MUST NOT 形成独立“第二套 UI 风格”）。
- 高频信息（状态、风险、动作结果）优先使用 icon + label 组合表达（仅文本为降级）。

## Impact

### 受影响模块（CodeMoss 主工程）

- 前端：
    - 新增 Spec Hub 页面与状态管理。
    - 新增 Environment Doctor 引导流程。
- 后端/桥接层：
    - 新增 CLI 调用适配层与文件系统监听。
    - 新增 Spec Runtime 数据模型与缓存策略。

### 受影响规范（codemoss-openspec）

- 未来可能新增/修改的主 spec 方向：
    - `spec-platform-runtime`
    - `spec-platform-ui`
    - `spec-platform-environment-management`
    - `spec-platform-adapter-openspec`
    - `spec-platform-speckit-hook`

### 兼容性与风险

- 风险 1：spec-kit 语义差异导致“看起来支持、实际不可执行”的认知偏差。
    - 缓解：首期明确标记 spec-kit 为“最小兼容模式（read-only + 跳转）”。
- 风险 2：本地环境复杂导致命令执行不稳定。
    - 缓解：Environment Doctor + 健康检查 + 降级到只读模式。
- 风险 3：多项目工作区造成状态混淆。
    - 缓解：按 workspace 维度强隔离缓存与命令上下文。

## Rollout Plan (High Level)

1. Phase 1（MVP）
    - OpenSpec Adapter 深支持
    - 只读 + 状态计算 + 基础动作执行（verify/apply/continue/archive）
2. Phase 2
    - Environment Doctor + Managed/BYO 双模式（以 OpenSpec 为主）
    - 完整 Action Rail 与时间线
3. Phase 3
    - spec-kit 最小兼容口子（detect/read-only/外部跳转）
    - 评估是否升级为完整 Adapter

## Success Metrics

- 新建/接入规范工作区成功率 ≥ 95%
- 从 proposal 到首次 apply 的中位耗时下降 ≥ 40%
- 验证失败定位平均耗时下降 ≥ 50%
- 使用 Spec Hub 完成闭环（proposal -> archive）的变更占比持续上升

## Open Questions

1. spec-kit 最小兼容是否需要包含 `validate` 透传，还是只做浏览与跳转？
2. Managed 模式的运行时安装位置与升级策略（全局 vs workspace）如何定义？
3. 何时触发“spec-kit 从口子升级为完整支持”的准入标准（用户量/失败率/维护成本）？
