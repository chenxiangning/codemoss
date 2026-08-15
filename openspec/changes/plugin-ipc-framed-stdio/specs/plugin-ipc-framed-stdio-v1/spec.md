# plugin-ipc-framed-stdio-v1 Spec Delta

## ADDED Requirements

### Requirement: Core MAY exchange MXPC frames over in-process framed stdio pipes

当调用方提供一对 stdin/stdout pipe 时，Core MUST 能写入完整 MXPC 帧并读回完整 MXPC 帧。该路径 MUST 复用 UDS 成帧函数，MUST NOT 使用 NDJSON，MUST NOT spawn OS 子进程。

#### Scenario: hello and ack round-trip on pipes

- **WHEN** Host 经 pipe 发送 MXPC hello
- **THEN** 对端 MUST 读出可被 `validate_handshake_hello` 接受的 hello
- **AND** Host MUST 读出可被 `validate_handshake_ack` 接受的 ack

#### Scenario: mismatched nonce is rejected after pipe read

- **WHEN** 对端回的 ack nonce 与 hello 不一致
- **THEN** `validate_handshake_ack` MUST 失败
