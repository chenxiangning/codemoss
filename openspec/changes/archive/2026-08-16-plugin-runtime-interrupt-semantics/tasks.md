# Tasks

- [x] 1.1 落盘 proposal + design + spec delta，明确「非终态中断」与「不承载 interrupted 标志 / 业务 ephemeral state」边界
- [x] 1.2 `openspec validate plugin-runtime-interrupt-semantics --strict --no-interactive`
- [x] 1.3 实现 `Host::interrupt(plugin_id, generation)`：句柄校验 → 反向拓扑 `driver.stop` → 清 `started`/`unit_id` → `state = Idle`
- [x] 1.4 测试：interrupt 停进程组并回 Idle 可再次 activate、stale/unknown generation 拒绝、非 Ready 拒绝且不调 stop；端到端真实 peer 进程 interrupt 闭环（`interrupt_stops_a_real_peer_process_group_and_returns_to_idle`）
- [x] 1.5 `cargo test --lib plugin_runtime::host`（23 passed）+ `cargo test --lib plugin_runtime::spawn`（22 passed）+ `cargo test --lib plugin_runtime`（282 passed）
- [x] 1.6 确认 `disable` / `fuse` 终态语义与 `boot_driver()` 未被改动
