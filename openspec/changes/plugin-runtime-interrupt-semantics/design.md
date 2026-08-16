# Design

`Host::interrupt` 对称 `dispatch` 的句柄校验口径（`generation == 0` → `stale-generation`、unknown plugin → `plugin-unavailable`、非 `Ready` → 对应状态错误、generation 不匹配 → `stale-generation`），但动作是**停进程 + 回 Idle**而非只校验。

与 `disable` 的差异仅一步：`disable` 停进程后 `slot.state = Disabled`（终态），`interrupt` 停进程后 `slot.state = Idle`（非终态，下次 `activate` 生成新 generation）。`unit_id` 一并清空（它是本次 activation 的 ephemeral 标识），`started` 清空（进程 ephemeral state）。

进程终止复用现有 `driver.stop`（`EntryDriver::stop`），对 `RestrictedProcessDriver` 而言即 `kill_child`（gap 2 的进程组 SIGKILL），故「中断 = 停掉真实进程组」在运行时侧已闭环。

`interrupted` 标志不落入 `PluginSlot`：它是迁入方（Claude 门面）的业务状态，通用运行时只承诺"interrupt 后 slot 回到可再次 activate 的 Idle 态"。
