# Codemoss Spec Platform Integration (OpenSpec First) - Design

## Context

CodeMoss 已有 OpenSpec 使用习惯，但目前规范流程仍依赖“终端 + 文件浏览”的手工协作。
目标是把规范系统从“文档集合”升级为“产品内可执行工作流”，并采用 OpenSpec-first 路线。

当前矛盾点：

- OpenSpec 与 spec-kit 命令、目录、artifact 结构不同，无法直接共用 UI。
- 新用户经常卡在环境准备（Node/Python/uv/CLI）而非业务需求。
- 规范与代码提交缺少同屏追踪，回归时需要跨多个上下文核对。

## Goals / Non-Goals

**Goals:**

- 定义统一 Spec Runtime 领域模型，优先稳定承载 OpenSpec。
- 提供 Spec Hub 工作台，覆盖“查看 -> 执行 -> 验证 -> 追踪”闭环。
- 定义 Managed/BYO 双模式环境策略，降低首次接入失败率。
- 明确 MVP 落地路径：OpenSpec 深支持，spec-kit 最小口子。

**Non-Goals:**

- 不在本变更内实现 OpenSpec 与 spec-kit 的 artifact 双向转换。
- 不重写两套上游 CLI，只做适配与编排。
- 不改动既有业务能力规范（如 git/history/opencode），仅新增平台能力。
- 不在 P0/P1 内实现 spec-kit 完整动作适配。

## Decision Summary

### Decision 1: 采用“三层模型”而非直接绑定 CLI 输出

分层：

1. `Spec Runtime Layer`（统一领域模型 + 状态机）
2. `Spec Adapter Layer`（OpenSpec 深支持 + spec-kit 最小 hook）
3. `Spec Workbench UI`（展示与动作）

原因：避免 UI 与某个 CLI 的输出格式强耦合，降低未来迁移成本。

### Decision 2: 采用“双模式安装策略”（Managed 默认，BYO 可选）

- Managed：CodeMoss 引导安装并维护依赖健康。
- BYO：复用用户系统中的现有环境与命令。

原因：兼顾新手体验和高级用户控制权。

### Decision 3: 文件系统为状态真相，CLI 为执行器

- 状态计算优先基于 `openspec/changes/**`、`specs/**`、`tasks.md` 等文件。
- CLI 主要用于执行动作（init/validate/archive 等）和提供补充校验。

原因：避免 CLI 返回差异导致 UI 状态不稳定；离线/降级能力更强。

### Decision 4: OpenSpec 深支持，spec-kit 仅最小兼容口子

- P0：OpenSpec 读写 + validate + action rail。
- P1：OpenSpec 环境托管与可观测增强。
- P2（可选）：spec-kit detect + read-only + 外部命令跳转。

原因：降低首期交付复杂度，控制风险。

### Decision 5: Spec Hub 采用“系统视觉复用 + icon-first”设计策略

- 视觉基线：复用现有 CodeMoss 设计令牌（spacing/radius/color/elevation/typography）。
- 组件基线：优先复用现有通用组件（panel/list/tag/button/tooltip），避免另起一套视觉体系。
- 信息编码：状态、动作可用性、风险等级、执行结果采用 icon + 文本双通道表达。

原因：保证产品一致性、降低认知负担、缩短新功能学习成本。

## Domain Model

```text
SpecWorkspace
  - id
  - rootPath
  - provider: "openspec" | "speckit"
  - supportLevel: "full" | "minimal"
  - mode: "managed" | "byo"
  - envHealth

SpecChange
  - id
  - title
  - status: draft | ready | implementing | verified | archived | blocked
  - updatedAt
  - owner?
  - artifacts[]

SpecArtifact
  - type: proposal | design | spec | tasks | verification | unknown
  - path
  - exists
  - completeness

SpecAction
  - key: explore | new | continue | apply | verify | archive
  - available
  - blockers[]
  - commandPreview
```

## Status Machine

状态判定（统一规则，adapter 可细化）：

1. `draft`: 存在 proposal，但 design/spec/tasks 不完整
2. `ready`: proposal + design + specs + tasks 完整
3. `implementing`: 任务开始执行（tasks 中出现已勾选项）
4. `verified`: verify 通过且无阻断项
5. `archived`: change 已归档目录
6. `blocked`: 环境异常或关键 artifact 缺失导致动作不可执行

状态迁移触发：

- 文件变化（watcher）
- CLI 执行结果
- 用户在 UI 的操作（如勾选任务、触发 verify）

## Architecture

```text
+------------------------------+
| Spec Hub (React/Tauri UI)   |
| - Changes List              |
| - Artifact Tabs             |
| - Action Rail               |
| - Trace Timeline            |
+--------------+--------------+
               |
               v
+------------------------------+
| Spec Runtime Service         |
| - workspace registry         |
| - status calculator          |
| - action preflight checker   |
| - timeline aggregator        |
+--------------+--------------+
               |
      +--------+--------+
      v                 v
+-----------+     +------------------+
| OpenSpec  |     | Spec-Kit Hook    |
| Adapter   |     | (minimal support)|
+-----+-----+     +--------+---------+
      |                    |
      v                    v
  CLI + FS          detect + read-only + passthrough
```

## Adapter Contract

```ts
interface SpecAdapter {
  detectWorkspace(rootPath: string): Promise<boolean>;
  getWorkspaceInfo(rootPath: string): Promise<SpecWorkspace>;
  listChanges(rootPath: string): Promise<SpecChange[]>;
  getArtifacts(rootPath: string, changeId: string): Promise<SpecArtifact[]>;
  getActionAvailability(
    rootPath: string,
    changeId: string
  ): Promise<SpecAction[]>;
  runAction(
    rootPath: string,
    changeId: string,
    action: SpecAction["key"]
  ): Promise<{ success: boolean; output: string; error?: string }>;
  validate(rootPath: string, changeId: string): Promise<{
    success: boolean;
    report: string;
  }>;
}

// For minimal-support providers (spec-kit in P2), runAction may only support
// passthrough actions and can return explicit unsupported blockers.
```

## UX Flow

### Flow A: 首次接入工作区

1. 用户进入 Spec Hub。
2. Environment Doctor 扫描：provider 可识别性 + 依赖健康。
3. 提供 `Managed` / `BYO` 选择。
4. 完成后进入 change 列表。

### Flow B: 变更执行闭环

1. 在 `Changes` 选中目标 change。
2. 中栏查看 artifacts，右栏显示推荐下一步动作。
3. 执行 `continue/apply/verify/archive`。
4. 输出写入 Timeline，并刷新状态机。

### Flow C: 失败与降级

1. 若环境异常：标记 `blocked`，展示修复建议。
2. 若 CLI 执行失败：保留文件状态，显示命令、stderr、建议动作。
3. 若 provider 不匹配：退化为只读浏览模式。

## UI System Alignment

### Visual Consistency Rules

1. Spec Hub MUST 复用系统级布局节奏（与侧栏/Topbar 内容区一致的纵向密度）。
2. Spec Hub MUST 使用统一状态色语义（success/warning/error/info）与现有模块一致。
3. Spec Hub MUST NOT 引入新的主色体系或独立阴影体系。
4. Spec Hub MUST 在浅色/深色主题保持相同信息层级可读性。

### Iconography Rules

1. Status Icon
    - `draft`: file/pencil
    - `ready`: check-circle
    - `implementing`: wrench/loader
    - `verified`: shield-check
    - `archived`: archive-box
    - `blocked`: alert-triangle
2. Action Icon
    - `continue`: arrow-right-circle
    - `apply`: play-circle
    - `verify`: badge-check
    - `archive`: archive
3. Risk Icon
    - low/medium/high 分别使用差异化 icon 与颜色强度。
4. 所有 icon MUST 配置 tooltip 或可访问名称，禁止仅凭颜色传达状态。

### Interaction Consistency Rules

1. 列表 hover/selected/focus 行为 MUST 与现有列表组件规则一致。
2. Action Rail 按钮反馈（loading/success/error）MUST 复用全局交互反馈样式。
3. Timeline 事件密度与分割规则 MUST 与现有活动流组件节奏一致。

## Environment Strategy

### Managed Mode

- CodeMoss 负责引导安装缺失依赖（以 OpenSpec 为主）。
- 定期健康检查（命令可执行、版本满足最小要求）。
- 异常时支持一键修复。

### BYO Mode

- 使用用户本机环境（PATH 中的 `openspec` / `specify`）。
- 记录实际命令路径与版本到诊断信息。
- 不干预用户环境，仅提供兼容告警。

## Risks / Trade-offs

- [Risk] spec-kit 仅最小支持时，用户误认为“完整兼容”
    - Mitigation: UI 显式标记 support level，禁止展示未支持动作。

- [Risk] Spec Hub 视觉风格偏离主系统，造成“拼装感”
    - Mitigation: 新增 UI 一致性门禁（token 使用率、组件复用率、主题可读性检查）。

- [Risk] CLI 输出格式变化引发解析抖动
    - Mitigation: 优先文件解析，CLI 输出只用于补充信息。

- [Risk] Managed 模式跨平台安装链路复杂
    - Mitigation: 分平台脚本 + 分步健康检查 + 可回退 BYO。

- [Risk] 状态机误判导致错误推荐动作
    - Mitigation: action rail 显示 blockers 明细，允许用户手动覆盖执行。

## Migration Plan

1. P0: OpenSpec Adapter + Spec Hub MVP（只读 + action + verify）
2. P1: Environment Doctor + Managed/BYO 双模式（OpenSpec 主路径）
3. P2: spec-kit minimal hook（detect/read-only/passthrough）
4. P3: trace timeline 与跨 provider 统一体验增强
5. P4: UI 一致性与 icon 语义验收（设计走查 + 可访问性检查）

Rollback Strategy:

- 若 adapter 稳定性不足，可临时回退到“只读 Spec Browser”模式。
- 若 Managed 安装链路不稳定，默认切换到 BYO 并提示手动修复。

## Open Questions

1. spec-kit minimal hook 是否需要包含 `validate` 透传，还是只读 + 跳转即可？
2. Managed 模式依赖安装路径采用全局还是 workspace 级隔离？
3. 是否在 P0 就引入“change 与 git commit 绑定规则”（如 commit footer）？
