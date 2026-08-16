# Wave Context Ledger Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-context-ledger-export-surface`  
> 结论：**方向正确。Composer / Settings / Status / Governance 改走 `@mossx/plugin-context-ledger/runtime`。** `ContextLedgerPanel` 目前没有产品导入，`ui` 仍再导出。实现仍在 `src/features/context-ledger`。未激活 Host。

## 证明

- `openspec validate plugin-context-ledger-export-surface --strict --no-interactive`
- vitest 包出口 + governance hook + harness evidence：8 passed
