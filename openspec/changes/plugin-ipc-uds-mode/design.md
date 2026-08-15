# Design

unix 上 `UnixListener::bind` 后 `PermissionsExt::set_mode(0o600)`。测试读 `metadata.permissions().mode() & 0o777`。
