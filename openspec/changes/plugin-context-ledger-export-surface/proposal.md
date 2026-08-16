# Proposal: plugin-context-ledger-export-surface

> OpenSpec change id: `plugin-context-ledger-export-surface`

## Why

Context Ledger 过渡仓只有 Manifest。Composer / Settings / Status / Governance 仍直达 `src/features/context-ledger`。下一步让生产导入走包出口，源码先留在原处。

## 目标与边界

1. `@mossx/plugin-context-ledger` MUST 再导出 runtime / ui。
2. Composer、Settings、Status、Governance 生产导入 MUST 走该包。
3. 产品实现 MUST 仍在 `src/features/context-ledger`。
4. MUST NOT 迁存储、MUST NOT 激活 Host。
5. `ContextLedgerPanel` 目前没有产品导入，`ui` 仍再导出以便后续插拔。

## Capabilities

- `plugin-context-ledger-export-surface-v1`
