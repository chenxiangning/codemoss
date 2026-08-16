# plugin-engine-pi-export-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: product Pi history imports MUST go through the in-repo package surface

会话 history factory MUST 从 `@mossx/plugin-engine-pi/runtime` 导入。`src/features/threads/loaders/pi*` MUST 仍保存实现。

#### Scenario: history factory uses the runtime export

- **WHEN** 读取 `useThreadActions.historyLoaderFactory.ts`
- **THEN** 它 MUST 包含 `@mossx/plugin-engine-pi/runtime`
- **AND** 它 MUST NOT 直达 `../loaders/piHistoryLoader`
