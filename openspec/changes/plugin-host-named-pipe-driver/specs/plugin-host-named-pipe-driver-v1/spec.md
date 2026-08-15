# plugin-host-named-pipe-driver-v1 Spec Delta

## ADDED Requirements

### Requirement: Host MUST fail closed when Named Pipe is unavailable or ACL is open

非 Windows 上 `NamedPipeHandshakeDriver` start MUST 失败。非法 pipe 名或空 / Everyone ACL MUST 失败。失败后 Host slot MUST 为 Failed，且不得留下 live start。

#### Scenario: a non-windows host cannot activate over named pipe

- **WHEN** 非 Windows 上用 Named Pipe driver 激活 Notes
- **THEN** `activate` MUST 失败
- **AND** slot state MUST 为 Failed

#### Scenario: an open named pipe ACL cannot start

- **WHEN** driver ACL 为 Everyone
- **THEN** `activate` MUST 失败
- **AND** driver `started` MUST 为空
