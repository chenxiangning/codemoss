# Design

`spawn_child` 在 `Command::new` 后立刻 `env_clear()`，再写入 handshake 变量。peer fixture 若看到 `MOSSX_SHOULD_NOT_INHERIT` 则拒绝 ack。回归在父进程设置该变量后仍能 handshake。
