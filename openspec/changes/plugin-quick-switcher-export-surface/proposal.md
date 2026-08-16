# Proposal: plugin-quick-switcher-export-surface

> OpenSpec change id: `plugin-quick-switcher-export-surface`

## Why

Quick Switcher 过渡仓只有 Manifest。AppShell / Git 仍直达 `src/features/quick-switcher`。下一步让生产导入走包出口，源码先留在原处。

## 目标与边界

1. `@mossx/plugin-quick-switcher` MUST 再导出 runtime / ui。
2. AppShell 与 Git 生产导入 MUST 走该包。
3. 产品实现 MUST 仍在 `src/features/quick-switcher`。
4. MUST NOT 迁存储、MUST NOT 激活 Host。Search 仍是 Core，MUST NOT 发明 `com.mossx.search`。

## Capabilities

- `plugin-quick-switcher-export-surface-v1`
