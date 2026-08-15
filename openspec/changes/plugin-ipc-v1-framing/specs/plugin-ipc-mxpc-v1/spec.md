# plugin-ipc-mxpc-v1 Spec Delta

## ADDED Requirements

### Requirement: Core MUST frame Control messages as MXPC V1

系统 MUST 使用 10 字节 header：`magic u32be = 0x4D585043`、`version u8 = 1`、`flags u8 = 0`、`payload_len u32le`。payload MUST 是单个 UTF-8 JSON-RPC 2.0 object，长度 MUST ≤ 1048576。系统 MUST NOT 接受 newline-delimited JSON 作为 Control transport。

#### Scenario: valid MXPC frame round-trips

- **WHEN** encoder 收到合法 JSON-RPC object
- **THEN** decoder MUST 还原同一 object
- **AND** header magic MUST 为 `MXPC`

#### Scenario: oversized or truncated control frame is rejected

- **WHEN** `payload_len` 大于 1 MiB，或剩余 bytes 少于声明长度
- **THEN** decoder MUST fail closed
- **AND** MUST NOT 产出部分 JSON-RPC 消息

#### Scenario: NDJSON control payload is rejected

- **WHEN** 输入以 `{` 或换行分隔的 JSON 文本开始且无 MXPC header
- **THEN** decoder MUST 返回 `ndjson-forbidden`
