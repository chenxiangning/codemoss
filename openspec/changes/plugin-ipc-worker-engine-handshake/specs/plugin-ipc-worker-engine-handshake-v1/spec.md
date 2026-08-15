# plugin-ipc-worker-engine-handshake-v1 Spec Delta

## ADDED Requirements

### Requirement: Worker handshake MUST complete on the live engine thread

`start` MUST 先创建 QuickJS Runtime。Unix 引擎线程 MUST 先 eval `mossx.handshake.hello()`，再 connect 私有 UDS 完成 hello/ack。错 nonce MUST drop Runtime，live_count MUST 为 0。MUST NOT 切产品。

#### Scenario: handshake runs on the live engine

- **WHEN** Notes worker 激活成功
- **THEN** isolate MUST 已拥有 Runtime
- **AND** 源码 MUST 在引擎线程发送 hello

#### Scenario: a bad engine ack cannot leave a runtime

- **WHEN** Worker ack nonce 被污染
- **THEN** 激活 MUST 失败
- **AND** live_count MUST 为 0
