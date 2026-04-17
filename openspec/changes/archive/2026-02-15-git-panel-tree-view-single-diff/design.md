# Design: Git 面板 Tree 视图与单文件 Diff 焦点

## Context

当前 Git 面板在 `diff` 模式下以分组平铺列表（已暂存/未暂存）展示文件，适合小规模改动；
但在多目录改动时，路径结构信息弱，定位成本高。

当前实现已具备可复用基础：

- `selectedDiffPath`：文件级焦点状态
- `GitDiffPanel`：集中承载列表与提交区交互
- 现有文件操作（Stage/Unstage/Revert/多选）逻辑已稳定

## Goals

1. 保留 Flat 视图，新增 Tree 视图，用户可快速切换。
2. Tree 中点击文件后进入单文件 Diff 焦点查看。
3. 不破坏现有 Git 操作链路和提交流程。

## Non-Goals

1. 不重写后端 Git 数据模型。
2. 不引入大型第三方树组件库。
3. 不在首版实现复杂的“树节点记忆恢复”策略（可后续增强）。

## Information Architecture

### View Mode

- `flat`：现有行为（默认）
- `tree`：新行为（目录树）

### Data Model (UI Layer)

将 `stagedFiles + unstagedFiles` 映射为树节点：

- `TreeFolderNode`
    - key/path
    - children
    - expanded
    - aggregate stats
- `TreeFileNode`
    - path
    - status(A/M/D)
    - additions/deletions
    - section(staged/unstaged)

### Diff Focus Mode

- 当 Tree 节点（文件）被点击：设置 `selectedDiffPath=path`
- Diff 展示层根据 `selectedDiffPath` 进入单文件聚焦
- 提供“返回全部”操作清空 `selectedDiffPath`

## Interaction Design

1. Git 头部增加 Flat/Tree 切换按钮（保持现有模式选择器并列）。
2. Tree 支持：
    - 目录展开/折叠
    - 文件选择高亮
    - 键盘导航（↑↓、←→、Enter）
3. 文件右键菜单与批量操作逻辑复用现有实现。

## Persistence

- 新增 workspace 级本地设置：`gitDiffListView: "flat" | "tree"`
- 默认 `flat`

## Compatibility

- Flat 视图完全保留。
- Stage/Unstage/Revert 行为与现有一致。
- Commit message 生成与提交按钮逻辑不变。

## Risks

1. Tree 渲染在大文件集下可能卡顿。
2. 多选与树层级交互可能出现边界不一致。

## Mitigations

1. 树节点构建 memo 化；仅展开可见节点。
2. 多选状态与视图解耦（始终以 path 集合为准）。
3. 首版优先保证单选与核心操作稳定，多选高级行为后续迭代。

## Validation

1. 交互验证：Flat/Tree 切换、树展开、单文件焦点。
2. 回归验证：Stage/Unstage/Revert、提交流程。
3. 性能验证：100+ 文件场景下滚动与切换不卡顿。
