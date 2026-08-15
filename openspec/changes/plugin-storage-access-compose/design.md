# Design

`PluginRuntime::access_store` = `ensure_ready(caller)` + `DiskStorage::access_file`。测试同时激活 Claude / Notes。
