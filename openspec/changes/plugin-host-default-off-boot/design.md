# Design

在 `runtime.rs` 测试里 `include_str!("../lib.rs")` 断言不包含构造调用。另测 `HostConfig::default().enabled`。
