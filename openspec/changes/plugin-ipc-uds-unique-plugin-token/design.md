# Design

`plugin_dir_token` 对完整 pluginId 做 FNV-1a 32-bit，输出 8 hex。目录仍是 `/tmp/m{pid}/{token}`。测试断言同后缀不同 pluginId 目录不同。
