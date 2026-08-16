# plugin-notes-export-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: product Notes imports MUST go through the in-repo package surface

布局与会话生产路径 MUST 从 `@mossx/plugin-notes` 导入。`src/features/note-cards` 与 `note_cards.rs` MUST 仍存在。

#### Scenario: layout imports the Notes panel from the package

- **WHEN** 读取 `useLayoutNodes.tsx`
- **THEN** 它 MUST 包含 `@mossx/plugin-notes/ui`
- **AND** 它 MUST NOT 直达 `note-cards/components/WorkspaceNoteCardPanel`

#### Scenario: messaging imports Notes runtime only

- **WHEN** 读取 `useThreadMessaging.ts`
- **THEN** 它 MUST 包含 `@mossx/plugin-notes/runtime`
- **AND** 它 MUST NOT 导入 `@mossx/plugin-notes/ui`
