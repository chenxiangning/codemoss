# Proposal: plugin-code-annotations-export-surface

> OpenSpec change id: `plugin-code-annotations-export-surface`

## Why

Code Annotations 过渡仓只有 Manifest。布局 / Composer / Files / Git 仍直达 `src/features/code-annotations`。下一步让生产导入走包出口，源码先留在原处。

## 目标与边界

1. `@mossx/plugin-code-annotations` MUST 再导出 runtime。
2. 布局、Composer、Files、Git 生产导入 MUST 走该包。
3. 产品实现 MUST 仍在 `src/features/code-annotations`。
4. MUST NOT 迁存储、MUST NOT 激活 Host。
5. 当前没有独立 UI 面板，MUST NOT 发明假面板。

## Capabilities

- `plugin-code-annotations-export-surface-v1`
