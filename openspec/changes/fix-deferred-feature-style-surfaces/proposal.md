# Proposal: 修复延迟加载 CSS 的入口漏接与 Git Diff 弹窗滚动合同

## Why

冷启动 P1-1 把 `multi-agent.css` / Status Panel CSS 卸出 `bootstrap.ts` 后，协作模板弹层与 Git Diff 顶栏「N/M 处差异」退化为裸文本。补样式时若整包拉 `status-panel-checkpoint-diff.css`，会改 `.editable-diff-compare` 的 overflow/height，单栏/双栏滚动互相拆墙。用户已手测确认双栏与单栏滚动、底部锚点均恢复。

## 目标与边界

- Shared Composer 协作入口在未打开 Inspector 时也能拿到 `multi-agent.css`。
- Git / History Diff 弹窗顶栏导航有样式，且不依赖 Status Panel 是否打开过。
- 同一弹窗内：单栏列表可滚、底部 hunk dock 可见可跳；双栏只在 CodeMirror scroller 滚。
- 1/1 处差异点击仍触发 scroll/flash。
- 不把已延后的 CSS 塞回 bootstrap；不整包加载 `status-panel.css`。

## 非目标

- 不回退冷启动 CSS 分级。
- 不改 diff 算法、virtualizer 数据模型、checkpoint 业务。
- 不把短 diff「拥抱内容」策略带回弹窗（那条路径已证明会裁掉单栏滚动与 dock）。

## What Changes

- `MultiAgentComposerToggle` 自己调用 `loadSubagentStyles`，弹层/模板管理等 `stylesReady`。
- `loadDiffStyles` 只拉 `editable-diff-compare-nav.css` + `editable-diff-review-shell.css`，不拉 checkpoint 整包。
- `git-diff-modal.css` 固定弹窗 viewer 高度，并写死两种模式的唯一纵向滚动层。
- compare 导航增加 `navigationEpoch`，1/1 环回仍 scroll。
- 无 **BREAKING** 变更。

## Capabilities

### New Capabilities

- `feature-style-surface-ownership`: 延迟 CSS 的加载点 MUST 是真正可见的宿主表面，禁止只挂在兄弟表面、禁止整包拉无关 feature CSS。
- `git-diff-modal-scrollports`: Git Diff 弹窗单栏滚动层是 `.diff-viewer`，双栏滚动层是 `.cm-scroller`；列容器 MUST NOT `overflow: auto`。

### Modified Capabilities

（无 — 既有 specs 未覆盖这两条合同）

## Impact

- 代码：Composer 协作入口、compare 导航、`featureStyleLoaders`、`git-diff-modal.css`、checkpoint CSS 收口。
- 复用：既有 `useFeatureStylesReady` / `loadSubagentStyles` / `loadDiffStyles`。
- 测试：源码契约 + modal layout 合同 + compare 1/1 再跳。
- 冷启动：`bootstrap.ts` 仍不静态引入 `multi-agent.css` / `status-panel.css`。
