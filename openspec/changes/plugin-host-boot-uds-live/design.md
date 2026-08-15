# Design

`bind_supervisor` 后 `try_clone` listener，后台线程 50ms poll accept。收到连接写 `host-disabled`。`AtomicBool` + Drop join 停线程，再 unlink。测试只 connect + 读错误帧，不调用 reject。
