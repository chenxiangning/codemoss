# plugin-engine-codex-export-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: product Codex history imports MUST go through the in-repo package surface

会话 history factory MUST 从 `@mossx/plugin-engine-codex/runtime` 导入。`src/features/threads/loaders/codex*` MUST 仍保存实现。

#### Scenario: history factory uses the runtime export

- **WHEN** 读取 `useThreadActions.historyLoaderFactory.ts`
- **THEN** 它 MUST 包含 `@mossx/plugin-engine-codex/runtime`
- **AND** 它 MUST NOT 直达 `../loaders/codexHistoryLoader`
