# plugin-ipc-mxpd-v1 Spec Delta

## ADDED Requirements

### Requirement: Core MUST frame Data messages as MXPD V1

系统 MUST 使用 18 字节 header：`magic u32be = 0x4D585044`、`version u8 = 1`、`flags u8`、`stream_id u32le`、`seq u32le`、`payload_len u32le`。payload 上限 MUST 为 1048576。flags bit0=`END`、bit1=`CANCEL`、bit2=`ACK`；bit3–7 MUST 为 0。V1 codec MUST 仅允许 `engine-event-v1`、`blob-v1`、`log-v1`。

#### Scenario: valid MXPD frame round-trips

- **WHEN** encoder 写入 stream_id/seq/payload
- **THEN** decoder MUST 还原相同字段
- **AND** magic MUST 为 `MXPD`

#### Scenario: reserved flags or unknown codec are rejected

- **WHEN** flags 的保留位被置位，或 codec 不在 V1 allowlist
- **THEN** decoder / open helper MUST fail closed

#### Scenario: send window is bounded

- **WHEN** 未 ACK 帧数达到 32 或未 ACK 字节达到 8 MiB
- **THEN** helper MUST 返回 `window-exceeded`
- **AND** MUST NOT 再 encode 下一 DATA 帧
