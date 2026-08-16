# plugin-local-permission-preview-v1 Spec Delta

## ADDED Requirements

### Requirement: Market MUST show declared capabilities before local staging

本地目录卡片 MUST 列出 Manifest 已声明 capability。预览 MUST NOT 读取 entry path。

#### Scenario: Notes card lists storage and workspace slot

- **WHEN** 打开市场本地目录
- **THEN** Notes 卡片 MUST 显示 `mossx.storage.readwrite`
- **AND** MUST 显示 `mossx.ui.slot.workspace.main`
