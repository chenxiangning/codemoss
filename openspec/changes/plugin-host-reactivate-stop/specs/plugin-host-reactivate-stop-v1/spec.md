# plugin-host-reactivate-stop-v1 Spec Delta

## ADDED Requirements

### Requirement: Ready re-activate MUST stop the previous generation

Ready 插件再次 `activate` MUST 先 stop 旧 generation 的 entries，再 start 新 generation。旧 isolate / child MUST 不再存活。

#### Scenario: a stale worker generation cannot eval

- **WHEN** Notes Ready 后再 activate
- **THEN** 旧 generation 的 `eval` MUST 返回 `plugin-unavailable`
- **AND** 新 generation 的 handshake eval MUST 成功

#### Scenario: a restricted process does not leak the old generation

- **WHEN** Notes 用 Restricted Process driver Ready 后再 activate
- **THEN** live child 数 MUST 等于 required entries 数
