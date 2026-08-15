# Design

`worker_memory_limit_ok` 拒绝 0 与 `> 256 MiB`。`spawn_engine` 在 `Runtime::new` 后立刻 `set_memory_limit(128 MiB)`。测试用独立小上限 Runtime 证明超限分配失败。
