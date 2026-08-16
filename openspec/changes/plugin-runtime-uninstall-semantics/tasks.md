# Tasks

- [x] 1.1 落盘 proposal + design + spec delta，明确「不可恢复卸载终态」与「不实现 lockfile / retention / install」边界
- [x] 1.2 `openspec validate plugin-runtime-uninstall-semantics --strict --no-interactive`
- [x] 1.3 `SlotState` 加 `Uninstalled` + `slot_state_name` 返回 `"uninstalled"`
- [x] 1.4 实现 `Host::uninstall`：`Ready` 反向拓扑 `driver.stop` → 清 `started`/`unit_id` → `Uninstalled`；`Uninstalled` 幂等、`Activating` 拒绝
- [x] 1.5 更新 `activate`/`fuse`/`disable`/`interrupt`/`reset` 对 `Uninstalled` 返回 `uninstalled`
- [x] 1.6 测试：uninstall 停进程组且不可恢复、幂等/Activating 拒绝、非 Ready 载入态进入终态；端到端真实 peer 进程 uninstall 闭环（`uninstall_stops_a_real_peer_process_group_and_is_irreversible`）
- [x] 1.7 组合层：`uninstall_and_revoke`（host_data）+ `PluginRuntime::uninstall_plugin`（runtime），对称 `disable`/`fuse`
- [x] 1.8 `cargo test --lib plugin_runtime::host`（27 passed）+ `cargo test --lib plugin_runtime::spawn`（23 passed）+ `cargo test --lib plugin_runtime`（288 passed）
- [x] 1.9 确认 `boot_driver()` 与生产引擎未被改动
