# plugin-ipc-mxpd-uds-v1 Spec Delta

## ADDED Requirements

### Requirement: Core MAY stream MXPD over an injected UDS after DataPlane open

当 DataPlane 已按 pluginId+generation open 时，Core MUST 能在注入短路径 UDS 上写出 MXPD 帧并对端读回相同 payload。`revoke` 之后对该 generation 的写入 MUST 失败。本路径 MUST NOT spawn 子进程，MUST NOT 使用 TCP。

#### Scenario: blob frame round-trips on injected UDS

- **WHEN** stream 以 `blob-v1` open 且经 UDS 写入一帧
- **THEN** 对端 MUST 读出相同 payload

#### Scenario: revoked generation cannot write on UDS

- **WHEN** 该 generation 已被 revoke
- **THEN** 再写 MUST 失败且 socket 上 MUST NOT 出现新数据帧
