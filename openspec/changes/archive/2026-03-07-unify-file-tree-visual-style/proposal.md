## Why

当前 Git 与工作区中多个“文件树/文件列表”区域在层级缩进、行高、圆角、hover/selected 样式、计数徽标和标题栏视觉上不一致，导致同一用户在不同面板切换时产生认知跳变。现在集中统一外观，可以在不改变任何业务行为的前提下，降低学习成本并提升整体产品一致性。

## What Changes

- 统一多个文件树视图的视觉规范（行高、缩进、图标尺寸、颜色 token、分组容器样式、徽标样式、展开收起图标样式）。
- 引入共享的“文件树视觉 token + 样式约束”，并在目标面板上对齐落地。
- 仅调整 UI 展示层（CSS/样式结构与可复用展示组件），不调整数据结构、状态机、命令调用、事件语义。
- 为“统一视觉但不改行为”补充回归校验条目，确保交互路径与结果保持一致。

### 目标与边界

- 目标：
  - 让图 1（树形聚合视图）与图 2（平铺列表视图）在“视觉语言”上统一为同一设计体系。
  - 统一范围聚焦在“文件树/文件列表容器及其行项表现”，不扩散到整个 Git 页面。
- 边界：
  - 不修改后端（Rust/Tauri command）与 API。
  - 不改变已有交互行为（选择、展开/折叠、提交、暂存/未暂存分区逻辑、上下文菜单语义）。
  - 不变更信息架构（分组顺序、字段含义、文案语义）。

### 非目标

- 不做新的文件树功能（例如新增过滤、批量操作、搜索、虚拟滚动）。
- 不做行为重构（例如统一状态源、替换现有树构建算法）。
- 不做跨模块大规模组件迁移（仅在本次目标面板内实施可控的样式统一）。

### 方案对比与取舍

| 方案 | 描述 | 优点 | 风险/缺点 |
| --- | --- | --- | --- |
| A. 仅统一 CSS token 与样式选择器 | 保留各面板现有渲染结构，仅通过共享样式变量和 class 对齐外观 | 改动小、风险低、最快落地，最符合“行为不变” | 长期仍存在一定重复样式片段 |
| B. 抽取共享展示组件（Presentation Component）+ 统一 token | 提炼通用 TreeRow/Section 外观壳，现有逻辑通过 props 注入 | 一致性更强、后续维护成本更低 | 初始改动更大，需要更细致回归避免行为漂移 |

取舍：优先采用 **A（主路径）**，在不触碰行为的前提下完成视觉统一；若实现中发现重复样式难以收敛，再在同一边界内小步引入 B 的局部壳层（仅展示层）。

## Capabilities

### New Capabilities

- `file-tree-visual-consistency`: 定义并约束多处文件树/文件列表的统一视觉规范，确保跨面板一致的外观表现且不改变行为契约。

### Modified Capabilities

- （无）

## Impact

- Affected frontend code:
  - `src/features/git/components/GitDiffPanel.tsx`
  - `src/features/git-history/components/GitHistoryPanel.tsx`
  - `src/features/git-history/components/GitHistoryWorktreePanel.tsx`
  - `src/styles/diff.css`
  - `src/styles/git-history.css`
- No backend/API impact:
  - Rust backend、Tauri commands、数据存储结构不变。
- Dependencies:
  - 不新增第三方依赖。

## Acceptance Criteria

- 视觉一致性：
  - 目标面板中的文件树行项（间距/缩进/高度/图标/hover/selected/徽标）达到统一规范。
- 行为零变化：
  - 选择、展开/折叠、暂存/未暂存分组、提交流程、右键菜单动作语义与当前版本一致。
- 接口零变化：
  - 无新增/删除/修改后端 API 或 Tauri command。
- 回归可验证：
  - 现有相关测试通过，且补充最小可行的 UI 回归校验（结构快照或关键 class 断言）。
