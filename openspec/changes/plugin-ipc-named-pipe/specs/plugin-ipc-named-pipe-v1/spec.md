# plugin-ipc-named-pipe-v1 Spec Delta

## ADDED Requirements

### Requirement: Core MUST use Named Pipe on Windows and reject other platforms

`bind_named_pipe` 的名字 MUST 匹配 `\\.\pipe\mossx-*`。非 Windows MUST 返回 `unsupported-platform`。Windows MUST 用该 pipe 完成 MXPC hello/ack；坏 nonce MUST 拒绝。

#### Scenario: a non-windows host cannot bind a named pipe

- **WHEN** 在非 Windows 上调用 `bind_named_pipe` 且名字合法
- **THEN** 调用 MUST 失败且错误码为 `unsupported-platform`

#### Scenario: an illegal pipe name is rejected

- **WHEN** 名字不是 `\\.\pipe\mossx-*`
- **THEN** 调用 MUST 失败且错误码为 `schema`

#### Scenario: windows hello and ack round-trip on a named pipe

- **WHEN** Windows 上绑定合法 pipe
- **THEN** client/server MUST 完成 MXPC hello/ack
- **AND** 坏 nonce MUST 被拒绝
