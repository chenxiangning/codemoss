# Design

对端是 `thread` + `UnixListener.accept`，不是子进程。路径仍短于 `SUN_LEN`。Windows 上 `start` 返回 Crash。
