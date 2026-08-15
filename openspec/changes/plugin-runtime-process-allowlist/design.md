# Design

`process_executable_ok` 先要求绝对路径且无 `..`，再看 file stem 是否在 deny-list。`spawn_child` 在 `is_file` 之前过闸门。测试直接 `start("com.mossx.engine.claude", "claude-cli")` 用 `/bin/sh`。
