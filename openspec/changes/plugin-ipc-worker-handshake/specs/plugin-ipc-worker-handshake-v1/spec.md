# plugin-ipc-worker-handshake-v1 Spec Delta

## ADDED Requirements

### Requirement: Worker isolate MUST complete handshake before becoming live

`QuickJsWorkerDriver::start` MUST 先完成 hello/ack。handshake 失败 MUST 不得插入 isolate。

#### Scenario: notes worker becomes ready only after handshake

- **WHEN** Host 激活 Notes
- **THEN** `notes-worker` isolate MUST live
- **AND** 该 isolate 的 generation MUST 等于当前 generation

#### Scenario: a bad worker nonce cannot leave an isolate

- **WHEN** Worker handshake ack 回错 nonce
- **THEN** 激活 MUST 失败
- **AND** live isolate 必须为 0
