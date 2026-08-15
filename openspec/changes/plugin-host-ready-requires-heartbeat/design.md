# Design

`EntryDriver::heartbeat` 默认 `Ok(())`。Host `activate` 在全部 `start` 成功后、写 Ready 前逐条 heartbeat。失败映射 `activation-failed`，LIFO `stop` 已 start 的 entries。`FakeDriver` 可按 entry 拒绝 heartbeat。
