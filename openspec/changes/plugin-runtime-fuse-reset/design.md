# Design

`PluginRuntime::reset_plugin` 转发 `Host::reset`。测试：fuse 后 reset，再 activate，generation 递增，三类 handle 恢复。
