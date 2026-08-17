# Design

```text
build.rs rustc packages/plugin-host/src/supervisor.rs
  → $OUT_DIR/plugin-host/bin/<platform>/host-supervisor

BootHost
  spawn supervisor with UDS path
  自己不再 accept
  drop → SIGKILL 进程组 + unlink

连接
  仍 host-disabled
  live_count == 0
```
