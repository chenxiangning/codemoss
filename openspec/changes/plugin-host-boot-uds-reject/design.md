# Design

`SupervisorSocket.listener` 可 `accept_uds_timed`。`reject_unexpected` 收下连接后写 `{"jsonrpc":"2.0","id":null,"error":{"code":-32000,"message":"host-disabled"}}`，再 drop stream。不读 hello，避免 disabled Host 参与身份交换。测试用线程 connect + 读错误帧。
