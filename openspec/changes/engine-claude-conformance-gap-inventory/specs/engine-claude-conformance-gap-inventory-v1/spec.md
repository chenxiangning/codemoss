# engine-claude-conformance-gap-inventory-v1 Spec Delta

## ADDED Requirements

### Requirement: Claude dual-run conformance gaps MUST be inventoried before product cutover

Core MUST 提供可核对的 conformance gap inventory。本 change MUST NOT 修改产品行为。MUST NOT 删除 `engine/claude*`。MUST NOT 把调用面断言当成产品 conformance。

#### Scenario: inventory lists interrupt as call-path only

- **WHEN** 读取 `docs/architecture/plugin-platform/inventory/claude-conformance-gaps.json`
- **THEN** interrupt MUST 标为 call-path-done
- **AND** stream / rollback / first-interactive MUST 标为 missing product acceptance

#### Scenario: product defaults stay off

- **WHEN** 未设置 `MOSSX_CLAUDE_COMPAT_FACADE`
- **THEN** 门面 MUST 仍默认关闭
- **AND** `engine/claude.rs` MUST 仍存在
