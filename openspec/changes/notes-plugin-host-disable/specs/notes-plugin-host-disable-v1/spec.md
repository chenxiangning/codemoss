# notes-plugin-host-disable-v1 Spec Delta

## ADDED Requirements

### Requirement: Notes Pilot MAY be disabled at the Host without deleting Core Notes

当 Notes fixture 已被 Host activate 时，Core MUST 能 `disable` 该 plugin。disable 之后再次 activate 与 Broker workspace.read MUST 失败。Core Notes 源码 MUST 仍存在。

#### Scenario: disabled notes fixture cannot reactivate

- **WHEN** `com.mossx.notes` 已被 disable
- **THEN** 再次 activate MUST 返回 `disabled`

#### Scenario: core notes implementation remains on disk

- **WHEN** 完成 Host disable
- **THEN** `src-tauri/src/note_cards.rs` MUST 仍存在
