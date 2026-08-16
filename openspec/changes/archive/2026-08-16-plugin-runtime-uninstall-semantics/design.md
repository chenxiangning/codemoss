# Design

`Host::uninstall` 是 `disable` 的「不可恢复」版本：`disable` 停进程后进 `Disabled`（`reset` 可恢复），`uninstall` 停进程后进 `Uninstalled`（`reset`/`activate` 一律拒绝，需重新 install 才能再进入生命周期）。

状态匹配沿用 `disable` 的口径：`Activating` → `activation-busy`，`Uninstalled` → 幂等 `Ok`；`Ready`/`Idle`/`Disabled`/`Fused` → 继续（`Ready` 停进程组，其余已停进程仅清态）。`Failed` 与 `disable` 一致拒绝（`failed`，异常态先 `reset`）。

进程终止复用 `driver.stop`（`RestrictedProcessDriver` 即 `kill_child` 进程组 `SIGKILL`），故「卸载 = 停掉真实进程组 + 进入不可恢复终态」在运行时侧闭环。

`uninstall` 的 lockfile 移除（`03` §10 第 1 步后半）、artifact retention（第 2 步）、数据 namespace 策略（第 3 步）与 `install`（`Discovered→Staged→Disabled`）均不在本 change：当前运行时无 lockfile / install 概念，本刀只把「卸载终态」落到状态机，不假装 lockfile 已存在。
