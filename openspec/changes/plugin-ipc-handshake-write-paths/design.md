# Design

`uds_driver` / `quickjs` / `spawn` 的 hello / ack 写改为 `write_mxpc_frame_timed`。测试用源码断言这三处 handshake 不再调用阻塞 `write_mxpc_frame(`。
