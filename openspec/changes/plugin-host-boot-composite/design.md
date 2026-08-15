# Design

`BootHost = PluginRuntime<CompositeDriver>`。process 用 `missing_executable()`，避免 boot 路径误 spawn。disabled 时 Host 在 `driver.start` 之前返回，live_count 两边都是 0。
