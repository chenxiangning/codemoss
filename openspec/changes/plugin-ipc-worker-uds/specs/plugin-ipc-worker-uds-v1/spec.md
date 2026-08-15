# plugin-ipc-worker-uds-v1 Spec Delta

## ADDED Requirements

### Requirement: Unix Worker handshake MUST use a private UDS

Unix `QuickJsWorkerDriver::start` MUST 在插入 isolate 之前完成一次私有 UDS hello/ack。handshake 失败 MUST 不得留下 isolate。

#### Scenario: notes worker becomes ready over private uds

- **WHEN** Host 在 Unix 上激活 Notes
- **THEN** `notes-worker` isolate MUST live
- **AND** handshake MUST 经过 `private_uds_path`

#### Scenario: a bad worker nonce cannot leave a uds isolate

- **WHEN** Worker UDS ack 回错 nonce
- **THEN** 激活 MUST 失败
- **AND** live isolate 必须为 0
