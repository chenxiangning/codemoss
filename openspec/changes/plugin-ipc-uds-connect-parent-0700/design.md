# Design

`connect_uds` 在 `UnixStream::connect` 之前调用 `parent_is_owner_only`。测试断言 `/tmp/mx-open.s` 与 0755 父目录 `permission-denied`。
