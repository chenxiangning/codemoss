# Design

`QuickJsWorkerDriver` 复用 `issue_handshake_nonce` + `validate_handshake_hello/ack`。handshake 成功才 `insert` isolate。`corrupt_ack_on` 用于回滚测试。
