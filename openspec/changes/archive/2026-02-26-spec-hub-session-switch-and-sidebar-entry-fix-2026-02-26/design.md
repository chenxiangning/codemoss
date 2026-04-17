## Context

该变更聚焦两个具体痛点：

1. Spec Hub 与会话导航存在前台状态竞争，用户点击会话后未触发正确的视图切换/面板退出。
2. Spec Hub 入口当前偏首页化，缺乏会话工作流中的常驻入口。

从 `pasted-image-1` 可见，Spec Hub 为完整工作台视图，若无显式退出联动，会导致会话列表点击行为被“吃掉”或被覆盖。

## Root Cause Hypothesis

- 导航层缺少“会话点击优先级高于 Spec Hub 前台态”的状态收敛逻辑。
- 入口策略单点依赖欢迎页，未遵循侧栏 rail 的全局入口职责。

## Design Principles

1. Navigation First：会话点击是全局一级导航，优先级高于面板停留状态。
2. Stable Entry Surface：高频能力需要在 rail 保持稳定入口。
3. Backward Compatible：保留欢迎页既有入口，新增不替换。
4. Non-Intrusive Layout：新增 icon 不破坏现有侧栏滚动/层级语义。

## Solution Outline

### A. Session Switch Override

- 在 Spec Hub 打开态下监听会话点击事件。
- 触发会话路由切换时，同步清理 Spec Hub 前台显示状态（关闭或退到后台）。
- 以“目标会话已激活”为成功判定，不允许停留在 Spec Hub 前台。

### B. Sidebar Bottom Entry for Spec Hub

- 在左侧 rail 底部操作区新增 Spec Hub icon 入口。
- 入口在 workspace 会话视图可见，点击后打开 Spec Hub。
- 保持欢迎页入口并行存在，避免路径回归。

## Trade-offs

- 方案 A（采用）：欢迎页入口 + 侧栏常驻入口并存。
    - 优点：任意上下文可达，学习成本低。
    - 成本：侧栏新增一个图标位，需要校验拥挤度。
- 方案 B（不采用）：仅迁移到侧栏，移除欢迎页入口。
    - 风险：破坏现有用户习惯，产生回归。

## Risks & Mitigations

- 风险：会话切换时误关闭其它面板。
    - 缓解：仅对 Spec Hub 前台态执行收敛，不影响非 Spec Hub 面板。
- 风险：底部 icon 与现有 rail icon 冲突。
    - 缓解：复用既有 rail icon 规范与 tooltip 语义。

## C. Gate Alignment Architecture（提案/验证/归档一致性）

### Problem Statement

当前架构在“归档前”有严格 preflight，但“提案完成后”与“验证触发前”没有同等校验，导致规则后置暴露。用户在流程末端才看到
`delta MODIFIED requirement missing` 类错误，产生“前面按钮都能走，最后突然失败”的体验断层。

### Design Goals

1. Preserve Strictness：归档门禁标准完全保留。
2. Shift-Left Feedback：将同一规则前移到更早阶段。
3. Single Source of Truth：三处动作共享同一 preflight evaluator。
4. Actionable Diagnostics：错误信息直达可修复动作，不只给报错文本。

### Solution

#### 1) Shared Preflight Evaluator

- 复用并抽象现有 delta-target 校验逻辑为统一能力（含 operation 解析、target spec 存在性、requirement title 对齐）。
- 输出统一结构：`blockers[]` + `hints[]` + `affectedSpecs[]`。
- 所有调用必须传入当前生效 spec root（优先 custom spec root）。

#### 2) Proposal Finalize Hook

- create/append proposal 成功并 refresh 后，立即执行 preflight evaluator。
- 若存在 blockers，在 proposal feedback 面板中显示“归档兼容性预检失败（前置）”区块，并附修复建议。
- 该阶段为软阻断：允许继续编辑，但明确标记“不可直接进入验证/归档”。

#### 3) Verify Guard Hook

- 点击验证前先运行同款 preflight evaluator。
- 若有 blockers：阻断 strict validate 调用，显示结构化错误与定位信息。
- 若无 blockers：继续执行现有 strict validate 流程。

#### 4) Archive Gate Remains Final Authority

- 归档前仍运行当前 preflight 逻辑，作为最终硬门禁与兜底裁决。
- 前置检查仅提升反馈时机，不改变最终准入规则。

### UX Notes

- 将错误文案分层：`问题描述` / `为什么触发` / `怎么修`。
- 修复建议示例：
    - 该 requirement 在目标 spec 不存在：考虑将 `MODIFIED` 改为 `ADDED`；
    - 或改为目标 spec 已存在的同名 requirement 并保持 MODIFIED。

### Observability

- 新增埋点：`spec_preflight_failed`，字段包括 `stage`（proposal_post/verify_pre/archive_pre）、`change_id`、`blocker_count`。
- 目标：观察失败是否从 archive_pre 向 proposal_post/verify_pre 前移，降低末端失败比例。
