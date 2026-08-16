# engine-claude-wave3-goal-criteria-v1 Spec Delta

## ADDED Requirements

### Requirement: Wave 3 Claude goal criteria MUST be inventoried without expanding into product disable

Core MUST 提供可核对的 Wave 3 目标完成条件 inventory。本 change MUST NOT 修改产品行为。MUST NOT 把产品 disable / slim / Marketplace 写成未完成项。MUST NOT 删除 `engine/claude*`。

#### Scenario: inventory maps the three required clauses

- **WHEN** 读取 `docs/architecture/plugin-platform/inventory/claude-wave3-goal-criteria.json`
- **THEN** adapter / default-off / disable-not-delete MUST 标为 evidence-complete
- **AND** product disable / slim / Marketplace / note_cards MUST 标为 out-of-scope

#### Scenario: product defaults stay off

- **WHEN** 未设置 `MOSSX_CLAUDE_COMPAT_FACADE`
- **THEN** 门面 MUST 仍默认关闭
- **AND** `engine/claude.rs` MUST 仍存在
