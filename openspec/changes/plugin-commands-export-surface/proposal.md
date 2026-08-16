# Proposal: plugin-commands-export-surface

> OpenSpec change id: `plugin-commands-export-surface`

## Why

Commands 过渡仓只有 Manifest。AppShell 仍直达 `src/features/commands`。下一步让生产导入走包出口，源码先留在原处。

## 目标与边界

1. `@mossx/plugin-commands` MUST 再导出 runtime。
2. AppShell 生产导入 MUST 走该包。
3. 产品实现 MUST 仍在 `src/features/commands`。
4. MUST NOT 迁存储、MUST NOT 激活 Host。
5. 当前没有独立 Commands UI，MUST NOT 发明假面板。

## Capabilities

- `plugin-commands-export-surface-v1`
