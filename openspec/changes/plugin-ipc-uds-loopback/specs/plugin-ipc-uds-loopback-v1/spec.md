# plugin-ipc-uds-loopback-v1 Spec Delta

## ADDED Requirements

### Requirement: Core MAY exchange MXPC frames over an injected Unix Domain Socket

当调用方注入 socket 路径时，Core MUST 能在该 UDS 上写入完整 MXPC 帧并读回完整 MXPC 帧。transport MUST NOT 使用 local TCP。socket 路径 MUST 由调用方注入，MUST NOT 硬编码产品路径。本 change MUST NOT spawn QuickJS / Restricted Process。

#### Scenario: hello and ack round-trip on temp UDS

- **WHEN** listener 绑定 temp socket 且 client 发送 MXPC hello
- **THEN** server MUST 读出可被 `decode_mxpc` 接受的 hello
- **AND** client MUST 读出可被 `validate_handshake_ack` 接受的 ack

#### Scenario: mismatched nonce is rejected after UDS read

- **WHEN** server 回的 ack nonce 与 hello 不一致
- **THEN** `validate_handshake_ack` MUST 失败
