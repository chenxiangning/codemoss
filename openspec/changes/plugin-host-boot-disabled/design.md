# Design

`plugin_runtime::boot::BootHost`：

- `HostConfig::default()`（`enabled=false`）
- `FakeDriver`（不 spawn）
- storage root 用临时目录，不写 `~/.ccgui`

`lib.rs::run` 在 `setup` 里 `app.manage(Mutex::new(boot_host()))`。测试只断言构造后 activate 失败。
