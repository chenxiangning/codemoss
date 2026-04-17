# Design: Git Panel Tree View Accessibility & Test Follow-up

## 1. 键盘导航设计

- 焦点容器：Tree 列表容器持有 roving focus 索引。
- 文件节点：可被方向键选中，`Enter` 触发与点击一致的 `onSelectFile(path)`。
- 目录节点：
    - `→` 在可展开时展开目录；
    - `←` 在展开状态时折叠目录；
    - 折叠状态下 `←` 回退到父目录（若可用）。

## 2. 快捷键设计

- 候选行为：Flat/Tree 视图切换。
- 实施顺序：
    1) 盘点现有快捷键；
    2) 选择无冲突组合；
    3) 在冲突时拒绝注册并输出日志提示。

## 3. 无障碍语义

- Tree 容器提供 `aria-label`，目录项提供 `aria-expanded`。
- 当前选中节点有清晰 `aria-selected` 与视觉焦点。
- 文件头按钮（全文/区域、split/unified）保持一致可读标签。

## 4. 测试策略

- Unit: 树构建与节点展开状态函数。
- Component: 视图切换、树文件选择、单文件焦点渲染。
- Regression: flat 模式 Stage/Unstage/Revert 与 commit 主链路。
- Manual perf: 记录大变更集滚动、切换、展开响应观察值。

## 5. 风险与缓解

- 风险：键盘交互与鼠标状态不一致。
- 缓解：统一复用同一选择状态源（selectedDiffPath + expanded state）。

- 风险：快捷键冲突导致误触。
- 缓解：先冲突扫描，必要时提供降级方案（仅命令面板入口）。
