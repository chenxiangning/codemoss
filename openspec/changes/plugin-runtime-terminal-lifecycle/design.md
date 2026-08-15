# Design

`Host::fuse` / `disable` 在 stop 之前按当前 state 分支：同态幂等返回 Ok；Activating 仍 `activation-busy`；其余终端 / Idle 失败。
