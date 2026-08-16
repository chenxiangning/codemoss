# plugin-prompt-distill-export-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: product Prompt Distill imports MUST go through the in-repo package surface

Messages 生产路径 MUST 从 `@mossx/plugin-prompt-distill/runtime` 与 `/ui` 导入。`src/features/prompt-distill` MUST 仍保存实现。

#### Scenario: MessagesCore uses the package export

- **WHEN** 读取 `MessagesCore.tsx`
- **THEN** 它 MUST 包含 `@mossx/plugin-prompt-distill/runtime`
- **AND** 它 MUST 包含 `@mossx/plugin-prompt-distill/ui`
- **AND** 它 MUST NOT 直达 `prompt-distill/hooks/usePromptDistillation`
