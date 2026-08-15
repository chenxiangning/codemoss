# plugin-ipc-mxpd-pipe-v1 Spec Delta

## ADDED Requirements

### Requirement: Core MAY stream MXPD frames only after a granted open

Data Plane MUST 拒绝未 `open` 的 MXPD。`open` MUST 校验 V1 codec。发送 MUST 遵守 32 帧 / 8 MiB 未 ACK 窗口。`CANCEL` 之后该 stream 的非 ACK 帧 MUST 被丢弃。本路径 MUST NOT spawn 子进程。

#### Scenario: send without open is rejected

- **WHEN** DataPlane 尚未 open stream
- **THEN** write MUST 返回错误，且 MUST NOT 写出字节

#### Scenario: blob frame round-trips on a pipe after open

- **WHEN** stream 以 `blob-v1` open 且写入一帧
- **THEN** 对端 MUST 读出相同 payload

#### Scenario: cancel drops later data frames

- **WHEN** stream 已 CANCEL
- **AND** 再写非 ACK 帧
- **THEN** write MUST 失败且对端 MUST NOT 再读到该帧
