# Proposal: plugin-terminal-export-surface

> OpenSpec change id: `plugin-terminal-export-surface`

## Why

Terminal 过渡仓只有 Manifest。AppShell / 布局仍直达 `src/features/terminal`。下一步让生产导入走包出口，源码先留在原处。

## 目标与边界

1. `@mossx/plugin-terminal` MUST 再导出 runtime / ui。
2. AppShell 与布局生产导入 MUST 走该包。
3. 产品实现 MUST 仍在 `src/features/terminal`。
4. MUST NOT 迁存储、MUST NOT 激活 Host。

## Capabilities

- `plugin-terminal-export-surface-v1`
