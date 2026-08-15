# Design

Unix `CommandExt::pre_exec` 里 `close(3..=1024)`。peer fixture 用 `fcntl(F_GETFD)` 扫描 `3..=256`，发现则 exit 5。测试先打开 `/dev/null` 再 handshake，必须 Ready。
