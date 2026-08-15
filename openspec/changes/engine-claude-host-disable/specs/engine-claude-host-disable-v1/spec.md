# engine-claude-host-disable-v1 Spec Delta

## ADDED Requirements

### Requirement: Claude Pilot MAY be disabled at the Host without deleting Core Claude

当 Claude fixture 已被 Host activate 时，Core MUST 能 `disable` 该 plugin。disable 之后再次 activate 与 Broker workspace.read MUST 失败。Core Claude 源码 MUST 仍存在。

#### Scenario: disabled claude fixture cannot reactivate

- **WHEN** `com.mossx.engine.claude` 已被 disable
- **THEN** 再次 activate MUST 返回 `disabled`

#### Scenario: core claude implementation remains on disk

- **WHEN** 完成 Host disable
- **THEN** `src-tauri/src/engine/claude.rs` MUST 仍存在
