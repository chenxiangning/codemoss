# plugin-context-ledger-export-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: product Context Ledger imports MUST go through the in-repo package surface

Composer 生产路径 MUST 从 `@mossx/plugin-context-ledger/runtime` 导入。`src/features/context-ledger` MUST 仍保存实现。

#### Scenario: Composer uses the runtime export

- **WHEN** 读取 `Composer.tsx`
- **THEN** 它 MUST 包含 `@mossx/plugin-context-ledger/runtime`
- **AND** 它 MUST NOT 直达 `context-ledger/utils/contextLedgerProjection`
