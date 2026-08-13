# Design: 修复延迟加载 CSS 的入口漏接与 Git Diff 弹窗滚动合同

## Context

- 冷启动 P1-1（`b29d08dda`）把 `multi-agent.css` 从 `bootstrap.ts` 挪到 `loadSubagentStyles()`，加载点只挂在 `SubagentInspectorDrawer`。抽屉仅在右栏打开时挂载，Shared Composer 底栏 pill 从不拉 CSS → 模板弹层裸文本。
- 「N/M 处差异」导航壳写在 `status-panel-checkpoint-diff.css`，只被 `status-panel.css` `@import`。Git Diff 走 `loadDiffStyles`，Status Panel 未开过就没有导航样式。
- 第一次补救把整包 checkpoint CSS 塞进 `loadDiffStyles`：`.editable-diff-compare { height:100%; overflow:hidden }` + 列 `overflow:auto` 抢走 CM 滚动层。
- 第二次为救单栏给 viewer 定高，但列容器仍 `overflow:auto`，双栏再次滚不动。
- 用户 2026-08-13 手测：双栏/单栏滚动与底部锚点均恢复。

## Goals / Non-Goals

- Goals：入口自己拉切片；弹窗两种模式各有唯一滚动层；1/1 可再跳；不回退冷启动分级。
- Non-Goals：不拥抱短 diff 高度；不改 checkpoint 业务；不改 virtualizer。

## Decisions

### 决策 1：延迟 CSS 按「可见宿主」接线，不塞回 bootstrap

- 方案 A（选定）：`ComposerToggle` 调 `loadSubagentStyles`；`loadDiffStyles` 只加 nav/shell 切片。
- 方案 B：把 `multi-agent.css` 塞回 bootstrap。破坏 P1-1 冷启动预算。
- 方案 C：新建 `loadMultiAgentComposerStyles`。与对方 loader 平行，易冲突。
- 结论：选 A。

### 决策 2：切片粒度 — 抽壳，不整包

- `editable-diff-compare-nav.css`：只含 `.editable-diff-compare-nav*`。
- `editable-diff-review-shell.css`：review 表面布局 + `is-toolbar-only { display:none }`。
- checkpoint 整包 `@import` 这两片，并把 compare overflow 收口到 `.checkpoint-diff-modal`。

### 决策 3：弹窗滚动合同写死两个互斥滚动层

| 模式 | 唯一纵向滚动层 | 禁止 |
|---|---|---|
| 单栏 unified | `.git-history-diff-modal-viewer .diff-viewer` | frame 按 virtualizer 总高拥抱 |
| 双栏 split | `.git-history-diff-modal-viewer .file-compare-cm .cm-scroller` | 列容器 `overflow: auto` |

Viewer 使用确定高度 `min(72vh, 100vh - 160px)`。列网格 `minmax(0, 1fr)`，避免 grid min-content 把 CM 撑满。

### 决策 4：1/1 环回用 `navigationEpoch`

`activeLineNumber` 不变时 effect 不重跑。点击上一处/下一处递增 epoch，强制 `scrollIntoView` + flash。

## Risks / Trade-offs

- [短 diff 弹窗不再拥抱内容] → 接受空白，换可滚动与可见 dock。
- [checkpoint 打开前 Git 弹窗没有整包 checkpoint 样式] → 有意；shell/nav 已覆盖 Git 路径。
- [CM 水平滚动] → 合同只锁纵向；横向仍由 CM scroller `overflow: auto` 承担。

## Migration Plan

- 部署：随版本发布；无数据迁移。
- 回滚：还原 `loadDiffStyles` 切片、`git-diff-modal.css`、ComposerToggle hook。

## Open Questions

- 无。
