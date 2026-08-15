# plugin-ipc-handshake-full-frame-deadline-v1 Spec Delta

## ADDED Requirements

### Requirement: handshake read MUST cover the full MXPC frame within the deadline

`read_mxpc_frame_timed` MUST 在同一 deadline 内读完 header 与 payload。只回 header 或半帧 MUST `handshake-timeout`。

#### Scenario: a header-only peer cannot complete handshake

- **WHEN** 对端只写 MXPC header 后沉默
- **THEN** timed 读 MUST `handshake-timeout`
