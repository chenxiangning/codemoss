# plugin-dictation-export-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: product Dictation imports MUST go through the in-repo package surface

App 控制器 MUST 从 `@mossx/plugin-dictation/runtime` 导入。`src/features/dictation` MUST 仍保存实现。

#### Scenario: dictation controller uses the runtime export

- **WHEN** 读取 `useDictationController.ts`
- **THEN** 它 MUST 包含 `@mossx/plugin-dictation/runtime`
- **AND** 它 MUST NOT 直达 `dictation/hooks/useDictation`
