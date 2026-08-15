# engine-claude-pilot-inventory Spec Delta

## ADDED Requirements

### Requirement: Claude Pilot MUST have an explicit inventory before extraction

在删除或双写任何 Claude 实现之前，仓库 MUST 提供 `com.mossx.engine.claude` inventory，区分 stay-in-Core、目标迁出与禁止跟随的其他 CLI。Inventory change 本身 MUST NOT 修改 Claude 生产行为。

#### Scenario: inventory names the first engine pilot

- **WHEN** 读取 `docs/architecture/plugin-platform/inventory/claude-pilot.json`
- **THEN** `pluginId` MUST 为 `com.mossx.engine.claude`
- **AND** `status` MUST 为 `inventory-only`

#### Scenario: other CLIs are not in the Claude move set

- **WHEN** 读取 `mustNotMoveWithClaude`
- **THEN** 列表 MUST 包含 codex、gemini、grok、kimi、opencode、pi 的 engine 路径
