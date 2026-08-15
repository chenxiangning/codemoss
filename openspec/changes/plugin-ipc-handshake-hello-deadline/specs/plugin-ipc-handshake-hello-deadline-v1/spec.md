# plugin-ipc-handshake-hello-deadline-v1 Spec Delta

## ADDED Requirements

### Requirement: accept-side hello MUST finish within the handshake deadline

UDS / Worker 接受端读 hello MUST 受 `HANDSHAKE_DEADLINE` 约束。连接后不写帧 MUST `handshake-timeout`。

#### Scenario: a silent connector cannot complete hello

- **WHEN** 对端 connect 后不写 hello
- **THEN** 接受端 timed 读 MUST `handshake-timeout`
