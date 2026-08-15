# plugin-ipc-mxpd-write-deadline-v1 Spec Delta

## ADDED Requirements

### Requirement: MXPD writes MUST complete within the handshake deadline

`write_mxpd_frame_timed` MUST 在给定 deadline 内写完一帧。MXPD UDS 路径 MUST 用 timed write。静默读者 MUST `handshake-timeout`。MUST NOT 切产品。

#### Scenario: a silent reader cannot complete an MXPD write

- **WHEN** Unix 上对端不读
- **THEN** `write_mxpd_frame_timed` MUST `handshake-timeout`
