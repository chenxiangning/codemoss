# Design

`uds_driver` / Worker accept 侧把 `read_mxpc_frame` 换成 `read_mxpc_frame_timed`。测试用短超时证明沉默连接不得完成 hello。
