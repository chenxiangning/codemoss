# Design

`handshake_deadline_ok` 比 2s。`read_mxpc_frame_timed` 先 `set_read_timeout`，再读帧；`TimedOut` 映射 `handshake-timeout`。spawn / UDS handshake 走 timed 读。
