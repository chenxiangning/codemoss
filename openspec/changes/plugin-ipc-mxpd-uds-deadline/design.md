# Design

`uds::read_exact_until` 升为 `pub(crate)`。`read_mxpd_frame_timed` 复用它读 header + payload。`mxpd_uds` 测试改 `accept_uds_timed` / `connect_uds_timed` / `read_mxpd_frame_timed`。新增 header-only peer 必须超时。
