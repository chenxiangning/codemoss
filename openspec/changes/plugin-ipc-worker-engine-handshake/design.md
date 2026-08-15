# Design

`start` 先 `spawn_engine`。Host bind UDS 后把 `Handshake` 发给引擎线程：eval hello → connect → 写 hello → 读 ack。Host accept、核验 hello、写 ack。错 nonce 时引擎 `validate_handshake_ack` 失败，`EngineHandle` drop。
