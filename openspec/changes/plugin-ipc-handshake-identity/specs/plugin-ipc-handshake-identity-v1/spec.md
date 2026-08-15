# plugin-ipc-handshake-identity-v1 Spec Delta

## ADDED Requirements

### Requirement: handshake ack MUST bind pluginId and generation

`validate_handshake_ack` MUST 在 nonce 之外核验 `pluginId` 与 `generation`。错插件或旧 generation MUST `handshake-rejected`。

#### Scenario: a notes ack cannot satisfy a claude handshake

- **WHEN** 期望 `com.mossx.engine.claude` generation 1
- **AND** ack 的 `pluginId` 为 `com.mossx.notes`
- **THEN** 校验 MUST 失败且错误码为 `handshake-rejected`

#### Scenario: a stale generation cannot satisfy the current handshake

- **WHEN** 期望 generation 2
- **AND** ack 的 generation 为 1
- **THEN** 校验 MUST 失败且错误码为 `handshake-rejected`
