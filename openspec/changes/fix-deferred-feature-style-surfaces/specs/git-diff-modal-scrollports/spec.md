# git-diff-modal-scrollports Spec Delta

## ADDED Requirements

### Requirement: Git Diff 弹窗 MUST 使用确定高度的 flex shell

`.git-history-diff-modal-viewer` SHALL 有确定高度（默认 `min(72vh, calc(100vh - 160px))`，最大化时填满剩余视口），`overflow: hidden`，`min-height: 0`。禁止用「拥抱 virtualizer 总高」让 `.diff-viewer-frame` `flex: 0 1 auto`。

#### Scenario: 单栏长 diff 可纵向滚动
- **WHEN** 用户在 Git Diff 弹窗切换到单栏并打开长文件
- **THEN** `.git-history-diff-modal-viewer .diff-viewer` MUST 是纵向滚动层（`overflow-y: auto`）
- **AND** 用户 MUST 能滚到文件底部

#### Scenario: 单栏底部 hunk dock 保持可见
- **WHEN** 单栏且全文查看使 hunk 锚点启用
- **THEN** `.diff-viewer-anchor-dock` MUST 钉在 viewer 底部（`flex: 0 0 auto`）且不被裁切
- **AND** 上一处 / 下一处 MUST 仍能 `scrollIntoView`

### Requirement: 双栏 compare MUST 只在 CodeMirror scroller 纵向滚动

双栏模式下列容器 SHALL `overflow: hidden`；列网格 SHALL 使用 `minmax(0, 1fr)` 把高度传给编辑器。纵向滚动 MUST 发生在 `.file-compare-cm .cm-scroller`。

#### Scenario: 双栏长文件可在左右栏滚动
- **WHEN** 用户在同一弹窗切换到双栏并打开长文件
- **THEN** `.editable-diff-compare-columns` MUST NOT `overflow: auto`
- **AND** 左右 `.cm-scroller` MUST 可独立上下滚动

#### Scenario: 1/1 处差异点击仍跳转
- **WHEN** 差异块只有 1 处，用户点击「下一处差异」或「上一处差异」
- **THEN** 系统 MUST 再次对当前 hunk 执行 `scrollIntoView` 与 flash
- **AND** 不得因为 `activeLineNumber` 未变而忽略点击
