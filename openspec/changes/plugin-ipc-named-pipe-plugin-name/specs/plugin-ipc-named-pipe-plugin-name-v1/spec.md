# plugin-ipc-named-pipe-plugin-name-v1 Spec Delta

## ADDED Requirements

### Requirement: Named Pipe names MUST be isolated by full pluginId

`private_pipe_name` MUST 由完整 reverse-DNS pluginId 派生 `\\.\pipe\mossx-*`。非法 pluginId MUST `schema`。`com.mossx.notes` 与 `com.evil.notes` MUST 不同。Windows handshake MUST bind 该管名。MUST NOT 切产品。

#### Scenario: same-suffix plugins do not share a named pipe

- **WHEN** 计算 `com.mossx.notes` 与 `com.evil.notes` 的管名
- **THEN** 两者 MUST 不同
- **AND** 两者 MUST 通过 `pipe_name_ok`
