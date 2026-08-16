# Proposal: plugin-runtime-uninstall-semantics

> OpenSpec change id: `plugin-runtime-uninstall-semantics`  
> Wave：P2.1 前置（卸载终态 · 状态机补 `Uninstalled`）  
> 依赖：`plugin-runtime-interrupt-semantics`（非终态中断）、进程组 kill（`spawn.rs`）  
> 架构：[`03` §1 状态机 / §10 Uninstall](../../../docs/architecture/plugin-platform/03-lifecycle-hot-swap-and-rollback.md) · [`real-uninstall-dependency-chain.md`](../../../docs/architecture/plugin-platform/inventory/real-uninstall-dependency-chain.md) 缺口 2

## Why

「真实卸载」依赖链里，缺口 2 是 `SlotState` 缺 `Uninstalled` 终态。当前 `Host`（`plugin_runtime/host.rs`）状态机只有 `Idle/Activating/Ready/Failed/Fused/Disabled`，`disable` 是「停用」而非「卸载」：disable 后 `reset` 即可恢复，无法表达「从 lockfile 移除、需重新 install 才能再 activate」的卸载终态（`03` §1：`Disabled → Uninstalled: remove from lockfile`）。

已补齐的运行时前置（进程组 kill + 非终态 interrupt + turn 句柄）让 `uninstall` 能真正「停掉真实进程组」，但缺一个不可逆的卸载终态把「卸载」与「停用」区分开。本刀补上 `Uninstalled` 终态 + `Host::uninstall`，使运行时状态机能表达「卸载 = 停进程组 + 进入不可恢复终态」。

## 目标与边界

1. `SlotState` 增加 `Uninstalled` 终态，`slot_state_name` 返回 `"uninstalled"`。
2. `Host::uninstall(plugin_id)`：从 `Ready`/`Idle`/`Disabled`/`Fused` 停掉进程组（`Ready` 反向拓扑 `driver.stop`）并清 `started`/`unit_id`，置 `Uninstalled`；`Uninstalled` 幂等返回 `Ok`；`Activating` 返回 `activation-busy`。
3. `uninstall` 后 `activate` MUST 返回 `uninstalled`；`fuse`/`disable`/`interrupt`/`reset` MUST 返回 `uninstalled`（卸载终态不可恢复，需重新 install）。
4. MUST NOT 实现 lockfile 移除 / artifact retention / 数据 namespace 策略（`03` §10 三步的 2、3 是后续 change）；MUST NOT 新增 `install`（`Discovered→Staged→Disabled` 是后续 change）。
5. MUST NOT 修改 `boot_driver()`（仍 `missing_executable()`），MUST NOT 迁入 `engine/claude.rs`。

## Capabilities

- `plugin-runtime-uninstall-v1`
