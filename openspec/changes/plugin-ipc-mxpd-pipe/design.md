# Design

`DataPlane` 持有 `opened: HashMap<stream_id, StreamState>`。`open` 校验 codec。`write_frame` 调 `can_send` 再 `encode_mxpd`。读侧 `read_mxpd_frame` 对称于 MXPC。CANCEL 把 stream 标 cancelled，后续非 ACK 返回 `cancelled` 且不写。
