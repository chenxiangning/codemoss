# plugin-ipc-mxpd-uds-deadline-v1 Spec Delta

## ADDED Requirements

### Requirement: MXPD UDS I/O MUST complete within the handshake deadline

`read_mxpd_frame_timed` MUST 在给定 deadline 内读完一帧。MXPD UDS 路径 MUST 用 timed accept / connect / read。header-only / 静默对端 MUST `handshake-timeout`。MUST NOT 切产品。

#### Scenario: a header-only peer cannot complete an MXPD read

- **WHEN** Unix 上对端只写 MXPD header
- **THEN** `read_mxpd_frame_timed` MUST `handshake-timeout`
