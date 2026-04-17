# Design: 统一文件树外观（零行为变更）

## Context

当前代码库中至少存在两套文件树/文件列表展示实现（Git Diff 面板与 Git History 工作区面板）。它们在视觉层出现明显差异（行高、缩进、分组容器、徽标、hover/selected 样式），但交互语义相近，导致用户在面板切换时产生认知跳变。

本次设计目标是把“视觉语言”统一为同一体系，同时严格保持以下不变：

- 后端与命令层不变（Rust/Tauri commands 不改）
- 数据结构与状态机不变
- 交互行为与结果不变（选择、展开、提交、菜单动作）

## Goals / Non-Goals

**Goals**

- 在目标面板统一文件树行项外观规范：高度、间距、缩进、图标、hover/selected、计数徽标、分组卡片样式。
- 建立共享视觉 token（CSS variables + 语义 class）并在目标面板落地。
- 保持现有行为路径与调用链路完全一致，只做展示层改造。
- 提供可验证的回归门禁，证明“样式统一但行为零漂移”。

**Non-Goals**

- 不新增文件树功能（过滤、搜索增强、虚拟滚动、批量操作）。
- 不重构现有树构建算法与状态来源。
- 不改动后端 API / Tauri command / 业务领域模型。
- 不做跨模块大规模组件替换，仅在目标面板内收敛样式。

## Scope

目标代码范围（与 proposal 对齐）：

- `src/features/git/components/GitDiffPanel.tsx`
- `src/features/git-history/components/GitHistoryPanel.tsx`
- `src/features/git-history/components/GitHistoryWorktreePanel.tsx`
- `src/styles/diff.css`
- `src/styles/git-history.css`

其中 `tsx` 仅允许做“展示 class 挂载/结构壳层微调”，禁止改动事件处理与业务逻辑分支。

## Architecture Decisions

### Decision 1: 以“共享视觉 token + 语义 class”作为统一主路径

- 选择：优先方案 A，保留现有渲染逻辑，仅把样式语义对齐到一组共享规则。
- 理由：最符合“行为不变”与“低风险快速落地”。
- 不选：先抽象统一 TreeRow 组件（方案 B）作为主路径。
- 不选原因：初始改动面过大，容易触发非预期行为漂移。

### Decision 2: 双面板样式收敛到同一视觉契约，而非追求 DOM 完全一致

- 选择：允许 `GitDiffPanel` 与 `GitHistoryWorktreePanel` 保持各自结构，但通过统一 class contract 达成同观感。
- 理由：减少重排风险，避免影响现有测试与事件命中区域。
- 实施：在两个面板挂载同语义 class（例如 row/container/badge/section/header），由样式层统一驱动。

### Decision 3: 展示改动必须“逻辑零侵入”

- 选择：所有行为函数、状态写入、命令调用保持原样；仅改 className、静态容器层、CSS。
- 理由：确保“外观改了，语义不变”可证明、可回滚。
- 禁止项：
  - 改动 `onClick/onContextMenu` 触发条件
  - 改动 flat/tree 分支逻辑
  - 改动 staged/unstaged 分组规则

### Decision 4: 视觉 token 分层

- Base tokens：行高、水平 padding、节点缩进单位、圆角、边框、分组背景。
- State tokens：`hover`、`selected`、`muted`、`badge-positive/badge-negative`。
- Density tokens：默认密度与窄面板最小可用尺寸。

通过 token 分层，确保未来新文件树区域可复用，不再复制黏贴局部魔法数字。

### Decision 5: 回归验证采用“行为守恒 + 视觉断言”双轨

- 行为守恒：复跑现有交互测试，确认选择/展开/提交/菜单动作无变化。
- 视觉断言：补最小 UI 断言（关键 class 存在性、状态 class 切换、结构快照）。
- 契约结果：只允许样式快照变化，不允许行为测试语义变化。

## Pseudo Flow（实施逻辑草图）

1. 梳理两个面板的行项结构与状态 class 差异。
2. 在 `diff.css` 与 `git-history.css` 中抽取并对齐视觉 token。
3. 在对应 `tsx` 为行项/分组/徽标挂载统一语义 class。
4. 清理重复样式与冲突选择器，确保优先级稳定。
5. 跑相关前端测试与最小手动回归，确认行为不回退。
6. 记录“改动只在展示层”的验证结论。

## Risks / Trade-offs

- [Risk] 样式优先级冲突导致局部 panel 外观异常。
  - Mitigation: 限定选择器作用域（面板根 class 前缀），避免全局污染。

- [Risk] class 调整引发旧快照大量变更，难以识别真实回归。
  - Mitigation: 分批提交（先 token，再 class 挂载），每批配套行为断言。

- [Risk] 为统一视觉而误改可点击区域大小，影响交互命中。
  - Mitigation: 明确最小点击区域，回归菜单/折叠箭头/行选择命中测试。

- [Risk] 历史面板与 diff 面板现有字号/密度差异过大，一次性完全拉齐影响阅读习惯。
  - Mitigation: 先对齐核心元素（行高、缩进、状态、徽标），保留少量面板特定细节。

## Validation Plan

- 自动化：
  - 运行 `GitDiffPanel`、`GitHistoryPanel` 相关测试，确认行为断言通过。
  - 新增或更新最小视觉结构断言（class contract）。
- 手动：
  - Flat/Tree 视图切换后样式一致性检查。
  - Staged/Unstaged 分组样式与计数徽标一致性检查。
  - hover/selected/active 在两个面板的视觉反馈一致性检查。
  - 右键菜单与提交按钮链路冒烟，确认行为不变。

## Rollback Plan

- 回滚策略为前端展示层回滚：撤销 `diff.css`、`git-history.css` 与对应 `tsx` 的 class 挂载变更。
- 不涉及后端与数据迁移，因此可快速恢复到改造前行为与外观。

## Open Questions

- 是否需要在本次变更中同步统一图标描边粗细，还是仅统一行项容器与状态色？
- 窄面板下优先保留哪些视觉元素（badge、次级文案、右侧统计）？
- 后续是否把共享 token 上提到全局设计系统（本次先不做）？
