# Design

`BootHost` 包一层 `PluginRuntime<CompositeDriver>` + 可选 `SupervisorSocket`。Unix 用 `private_uds_path("com.mossx.host", "h{seq}")` + `bind_uds` + `UnlinkOnDrop`。不启动 accept 循环，不 handshake。`Deref` 到 runtime，boot 测试与 `lib.rs::manage` 不用改调用面。
