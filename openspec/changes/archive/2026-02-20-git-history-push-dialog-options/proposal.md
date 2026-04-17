## Why

当前 Git History 顶部 `推送` 按钮虽然已升级为弹窗确认，但仍缺少“本次推送内容预览”。用户在点击确认前，无法看到：

- 本次将要推送的提交列表
- 选中提交的文件变更与详情

对于需要确认推送边界、避免误推的场景，这一信息缺失仍是主要风险点。

## 目标与边界

- 目标
    - 将 `推送` 动作改为“先弹窗确认，再执行 push”。
    - 支持图2核心配置能力：当前分支只读展示、远端、目标远端分支（下拉选择 + 手写输入）、Push to Gerrit、Topic、Reviewers、CC、Push
      tags、Run Git hooks、Force with lease。
    - 在 Push Dialog 中展示“本次推送信息列表与详情”（提交列表 + 文件树 + 提交详情）。
    - 保持默认行为兼容：用户不改参数时，效果应等价于当前 push（向上游推送）。
- 边界
    - 不追求与 JetBrains Push Dialog 100% 像素级一致。
    - 不实现 JetBrains 全量高级能力（如多仓统一推送编排、复杂交互变基入口）。
    - 不改变 pull/sync/fetch 的既有流程。

## 非目标

- 不新增独立 Push 页面。
- 不改动提交历史列表的渲染与分页。
- 不引入第三方 Git SDK 依赖。

## What Changes

- Git History 顶部 `推送` 按钮从“直接执行”改为“打开 Push Dialog”。
- Push Dialog 提供以下配置项：
    - 当前分支（只读，不可编辑）
    - 远端（Remote）
    - 目标远端分支（Target Remote Branch，下拉候选 + 手写）
    - Push to Gerrit（开启后展示 Topic/Reviewers/CC）
    - Push tags
    - Run Git hooks
    - Force with lease
- Push Dialog 新增预览区：
    - 本次推送提交列表（Outgoing Commits）
    - 选中提交的变更文件树
    - 选中提交的详情摘要（message/author/sha/time）
- 预览区双栏采用固定高度容器，列表区与详情区分别独立滚动，避免长内容挤压布局或文本重叠。
- 选中提交后仅更新右侧详情，不自动打开文件 diff；用户点击“变更文件”条目时，才弹出独立 diff 预览弹窗。
- 当目标远端分支在本地 remote refs 不存在时，弹窗进入“新分支首次推送”模式：
  - 顶部目标摘要显示 `New` 标签
  - 保留预览区域占位，但不展示提交列表项与提交详情内容
  - 显示“本地未发现目标远端引用，将按新分支首次推送处理”的语义化提示
- Push Dialog 使用自定义下拉/Toggle UI，尽量避免原生 `select/checkbox`。
- 远端下拉菜单固定向上展开，避免与底部操作区重叠。
- `Push to Gerrit` 切换后，顶部目标摘要需实时切换为 `refs/for/<branch>` 语义。
- 确认后才执行 push，取消不会产生副作用。
- 远端/目标远端分支变化时，预览区需要自动刷新。
- 无可推送提交时，展示空态并禁用确认推送按钮。
- 后端 `push_git` 命令扩展可选参数，并支持 Gerrit refspec 构造（`refs/for/<branch>` + `%topic/r/cc`）。
- 前后端增加对应参数映射与测试覆盖。

## 技术方案对比

### 方案 A：保留一键 push，仅加二次确认

- 优点：实现快。
- 缺点：无法满足图2参数配置能力。
- 结论：不采纳。

### 方案 B：Push Dialog + 可选参数执行（采纳）

- 优点：风险可控、扩展性好、覆盖 Gerrit 场景。
- 缺点：前后端改动面稍大。
- 结论：采纳。

### 方案 C：全部参数下沉到后端自动推断

- 优点：前端简单。
- 缺点：用户缺乏显式控制，调试困难。
- 结论：不采纳。

### 方案 D：Push Preview 仅复用当前历史列表数据

- 优点：实现成本低。
- 缺点：无法保证与 `remote:targetBranch` 精确对齐，容易出现“看见的提交”和“实际推送提交”不一致。
- 结论：不采纳。

### 方案 E：Push Preview 基于目标分支比较结果（采纳）

- 优点：预览内容与实际推送范围一致，可验证性强。
- 缺点：需要补充比较查询与状态管理。
- 结论：采纳。

## Capabilities

### New Capabilities

- 无

### Modified Capabilities

- `git-history-panel`: 推送入口升级为确认弹窗与参数化执行。
- `git-operations`: push 操作支持可选参数与 Gerrit 推送语义。

## Impact

- 前端
    - `GitHistoryPanel` 新增 Push Dialog 状态与交互。
    - Push Dialog 新增 outgoing commits 预览区域与详情区域。
    - 新增 push 配置 i18n 文案。
- 后端
    - `push_git` 命令参数扩展与执行分支增强。
    - 增加 push preview 比较查询（用于计算本次推送提交集）。
- 测试
    - Push Dialog 交互测试。
    - Push preview 列表、详情、空态测试。
    - tauri wrapper push 参数映射测试。
    - Rust 编译校验与回归。

## 实施进展（2026-02-20）

- 已完成：Push Dialog 参数化、Gerrit refspec 语义、push preview 双栏与新分支首次推送模式、文件 diff 弹窗化、远端下拉上弹。
- 已完成：`targetFound=false` 场景下隐藏提交明细项并保留占位结构，目标摘要显示 `New` 标签。
- 已完成：图稿对照手工验收与发布说明收口（见 `tasks.md` 第 10 节与 `release-notes.md`）。

## 验收标准

- 点击顶部 `推送` 时，必须先打开 Push Dialog，不得直接 push。
- 弹窗必须将当前分支设为只读，不允许直接编辑。
- 弹窗必须支持目标远端分支“下拉选择 + 手写输入”。
- 弹窗必须展示“本次推送提交列表”与“选中提交详情（含文件变更）”。
- 远端或目标远端分支变化时，预览内容必须跟随刷新。
- 当目标远端分支不存在时，必须切换为“新分支首次推送”展示：显示 `New` 标签和语义化提示，不展示提交列表/详情明细项。
- 无可推送提交时，必须展示空态并禁用确认推送。
- 开启 `Push to Gerrit` 后，必须出现 Topic/Reviewers/CC 输入项。
- 点击确认后，系统必须按配置参数执行 push。
- 关闭弹窗（取消/遮罩/Escape）不得触发 push。
- 默认配置下（不调整参数）行为应兼容原推送路径。
- 失败时必须给出可读错误与重试提示。
