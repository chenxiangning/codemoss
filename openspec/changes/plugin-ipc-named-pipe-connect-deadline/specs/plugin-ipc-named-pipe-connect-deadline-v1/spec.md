# plugin-ipc-named-pipe-connect-deadline-v1 Spec Delta

## ADDED Requirements

### Requirement: Named Pipe accept and connect MUST complete within the handshake deadline

`connect_named_pipe_timed` / `accept_named_pipe_timed` MUST 在给定 deadline 内完成。Windows connect MUST 先 `WaitNamedPipeW`。超时 MUST `handshake-timeout`。超时毫秒 MUST NOT 是 `NMPWAIT_WAIT_FOREVER`。Host driver handshake MUST 走 timed accept / connect。非 Windows 过闸后 MUST `unsupported-platform`。MUST NOT 切产品。

#### Scenario: a missing named pipe cannot hang connect

- **WHEN** 调用 `connect_named_pipe_timed`
- **THEN** 等待 MUST 受 handshake deadline 约束
- **AND** 超时 MUST `handshake-timeout`

#### Scenario: non-windows still fail-closed after the name gate

- **WHEN** 在非 Windows 上对合法 `mossx-*` 管名调用 timed connect
- **THEN** 它 MUST `unsupported-platform`
