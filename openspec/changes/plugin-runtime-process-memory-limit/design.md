# Design

`process_memory_limit_ok` 拒绝 0 / `> 2048 MiB`。spawn 必须带 `MOSSX_PROCESS_MEMORY=512MiB`。Unix `pre_exec` 在关 FD 之后尝试设 512 MiB：Linux `RLIMIT_AS` 失败则 spawn 失败；macOS `RLIMIT_DATA` 若 EINVAL（内核拒绝下调）不阻断 spawn。peer 必须看到声明预算；Linux 还核验 `RLIMIT_AS`。
