# Design

Unix 增加 `write_all_until`：fd 非阻塞 + `poll(POLLOUT)`。`write_mxpc_frame_timed` 在 deadline 内写完 header+payload。测试用 `UnixStream::pair` + 大 payload，读端不读，30ms 超时。boot `reject_one` 改 timed write。
