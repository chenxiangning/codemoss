# Design

`sock_path` / `worker_sock_path` 改成 `Result`。失败直接 `DriverError::Crash`。测试断言源码不再含 `/tmp/mx-open.s`。
