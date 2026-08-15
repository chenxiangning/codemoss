# plugin-ipc-handshake-core-contract-v1 Spec Delta

## ADDED Requirements

### Requirement: handshake hello MUST bind coreContract 1.0.0

`validate_handshake_hello` MUST 要求 `params.coreContract == "1.0.0"`。缺失或 major 不匹配 MUST `handshake-rejected`。

#### Scenario: a current contract hello is accepted

- **WHEN** hello 声明 `coreContract=1.0.0`
- **THEN** 校验 MUST 成功

#### Scenario: a major-mismatched hello cannot start handshake

- **WHEN** hello 声明 `coreContract=2.0.0` 或缺失该字段
- **THEN** 校验 MUST `handshake-rejected`
