# Design

`BootHost = PluginRuntime<UdsHandshakeDriver>`。`boot_host()` 仍 `HostConfig::default()`。disabled Host 在 `activate` 入口返回，不会调用 `driver.start`，因此不会 bind UDS。
