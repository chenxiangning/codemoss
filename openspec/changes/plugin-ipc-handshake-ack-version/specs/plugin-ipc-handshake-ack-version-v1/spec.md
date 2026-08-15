# plugin-ipc-handshake-ack-version-v1 Spec Delta

## ADDED Requirements

### Requirement: handshake ack MUST bind the plugin version

`validate_handshake_ack` MUST 要求 `result.version` 等于当前 Manifest version。缺失或漂移 MUST `handshake-rejected`。

#### Scenario: a current version ack is accepted

- **WHEN** ack 声明 `version=1.0.0` 且当前 Manifest 也是 `1.0.0`
- **THEN** 校验 MUST 成功

#### Scenario: a drifted version cannot satisfy the handshake

- **WHEN** ack 声明 `version=9.9.9` 或缺失该字段
- **THEN** 校验 MUST `handshake-rejected`
