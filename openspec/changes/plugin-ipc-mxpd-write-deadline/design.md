# Design

`uds::write_all_until` 升为 `pub(crate)`。`write_mxpd_frame_timed` 复用它。`DataPlane::write_frame_timed` 走同一套 stream 闸门后再 timed write。UDS 测试改 timed write；新增 silent-reader 必须超时。
