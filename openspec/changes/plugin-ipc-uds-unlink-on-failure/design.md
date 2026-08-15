# Design

`uds_driver::handshake` 在 `peer.join()` 之后无条件 `remove_file`。测试激活错 nonce 后断言 socket path 不存在。
