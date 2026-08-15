# Design

短路径 `/tmp/md{pid}{seq}.s`。Host 端 `UnixStream::connect`，对端 `accept` 后 `read_mxpd_frame`。`DataPlane::open` 仍绑定 plugin+generation。
