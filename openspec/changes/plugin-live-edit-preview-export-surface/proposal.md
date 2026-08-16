# Proposal: plugin-live-edit-preview-export-surface

> OpenSpec change id: `plugin-live-edit-preview-export-surface`

## Why

Live Edit Preview 过渡仓只有 Manifest。AppShell 仍直达 `src/features/live-edit-preview`。下一步让生产导入走包出口，源码先留在原处。

## 目标与边界

1. `@mossx/plugin-live-edit-preview` MUST 再导出 runtime。
2. AppShell 生产导入 MUST 走该包。
3. 产品实现 MUST 仍在 `src/features/live-edit-preview`。
4. MUST NOT 迁存储、MUST NOT 激活 Host。
5. 当前没有独立 UI 面板，MUST NOT 发明假面板。

## Capabilities

- `plugin-live-edit-preview-export-surface-v1`
