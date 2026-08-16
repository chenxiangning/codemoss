# Design

Command 走独立 `plugin_rack` 模块，不把 `plugin_runtime` 写进 `command_registry`。快照合并「已声明插头」与 Host live slot。boot 未激活时两个插头都是 idle。UI 不提供安装 / 启用按钮。
