# engine-claude-history-remaining-call-sites-v1 Spec Delta

## ADDED Requirements

### Requirement: remaining Claude history call sites MUST be inventoried before disable-not-delete

Core MUST 提供可核对的 remaining inventory。本 change MUST NOT 修改产品行为。MUST NOT 删除 `engine/claude_history*`。

#### Scenario: inventory separates operations from types

- **WHEN** 读取 `docs/architecture/plugin-platform/inventory/claude-history-remaining.json`
- **THEN** 必须标明产品操作已走门面
- **AND** 必须列出类型 / 常量 / `encode_project_path` 残留

#### Scenario: product operations stay facaded

- **WHEN** 检查 GUI / daemon / catalog / native continuation 生产调用
- **THEN** MUST NOT 直调 `claude_history::list_*` / `load_*` / `hydrate_*` / `fork_*` / `delete_*` / `resolve_*`
