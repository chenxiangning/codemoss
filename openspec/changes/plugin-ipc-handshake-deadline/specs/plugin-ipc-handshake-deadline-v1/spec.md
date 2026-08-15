# plugin-ipc-handshake-deadline-v1 Spec Delta

## ADDED Requirements

### Requirement: handshake MUST complete within 2 seconds

Host 读 ack MUST 受 `HANDSHAKE_DEADLINE` 约束。超过 2s 或读超时 MUST `handshake-timeout`，且不得留下 live child / isolate。

#### Scenario: two seconds is the handshake deadline

- **WHEN** `handshake_deadline_ok` 收到恰好 2s
- **THEN** 校验 MUST 成功
- **AND** 收到 2001ms MUST `handshake-timeout`

#### Scenario: a silent peer cannot complete handshake

- **WHEN** handshake 读帧遇到不写回的对端
- **THEN** 读 MUST 以 `handshake-timeout` 失败
