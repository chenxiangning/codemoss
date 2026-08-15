# Design

`CREATE_NO_WINDOW = 0x0800_0000`。`windows_process_flags_ok(flags)` 要求该 bit，拒绝 `CREATE_NEW_CONSOLE`。`windows_inherit_handles_ok(inherit_extra)` 仅接受 `false`。Windows `close_inherited_fds` 调 `CommandExt::creation_flags`。
