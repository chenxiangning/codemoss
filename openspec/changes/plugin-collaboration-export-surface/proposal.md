# Proposal: plugin-collaboration-export-surface

> OpenSpec change id: `plugin-collaboration-export-surface`

## Why

Collaboration 过渡仓只有 Manifest。AppShell 仍直达 `src/features/collaboration`。下一步让生产导入走包出口，源码先留在原处。

## 目标与边界

1. `@mossx/plugin-collaboration` MUST 再导出 runtime。
2. AppShell 生产导入 MUST 走该包。
3. 产品实现 MUST 仍在 `src/features/collaboration`。
4. MUST NOT 迁存储、MUST NOT 激活 Host。
5. 当前没有独立 Collaboration UI，MUST NOT 发明假面板。

## Capabilities

- `plugin-collaboration-export-surface-v1`
