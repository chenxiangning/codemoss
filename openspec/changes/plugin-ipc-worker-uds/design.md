# Design

`handshake_worker` 在 Unix 上复用 `bind_uds` / `accept_uds` / `connect_uds` / `read_mxpc_frame_timed`。socket 落在 `private_uds_path`。失败删文件。非 Unix 保留内存往返。
