# Proposal: plugin-runtime-interrupt-semantics

> OpenSpec change id: `plugin-runtime-interrupt-semantics`  
> Wave：P4.7 前置（第二根插头 · 非终态中断）  
> 依赖：`engine-claude-runtime-driver`（第一根插头 · 真实 driver 通路）  
> 关联：`docs/architecture/plugin-platform/inventory/claude-process-migration-gap.md` gap 4

## Why

Claude 的 `interrupt()`（`engine/claude.rs`）是**非终态**中断：先置 `interrupted` 标志，再 drain 全部 turn 进程组，逐个 `terminate_child_process`（SIGTERM→SIGKILL 整组），然后清 `clear_turn_ephemeral_state`；中断后 session 仍可继续 `send_message`（下一个 turn）。

插件运行时的 `Host`（`plugin_runtime/host.rs`）目前只有 `disable` / `fuse` 两条**终态**路径（进 `Disabled` / `Fused` 直到 `reset`）。`disable` 虽然会反向拓扑 `driver.stop` 停进程组（gap 2 已补进程组 kill），但它把 slot 钉进终态，无法表达"停止当前生成、但插件仍可再次 activate"的中断语义。

因此「把 Claude 迁到插件运行时」缺一个运行时入口：**非终态 interrupt**——停当前 generation 的进程组 + 清进程 ephemeral state（`started`）+ 回 `Idle` 可再次 activate。这是 gap 4 的运行时侧落地；`interrupted` 标志与 Claude 业务 ephemeral state（tool tracking 等）由迁入方负责，本 change 不承载。

## 目标与边界

1. `Host` 增加 `interrupt(plugin_id, generation)`：校验 generation 是当前句柄，反向拓扑 `driver.stop` 停全部 started entry 的进程组（复用 gap 2 的进程组 kill），清 `started`，slot 置回 `Idle`（非终态，可再次 activate）。
2. `interrupt` MUST 拒绝 `generation == 0`、unknown plugin、非 `Ready` slot、`stale-generation`（与 `dispatch` 同口径）。
3. MUST NOT 改变 `disable` / `fuse` 的终态语义，MUST NOT 新增 `Uninstalled` 状态（超纲）。
4. MUST NOT 修改 `boot_driver()`（仍 `missing_executable()`），MUST NOT 迁入 `engine/claude.rs`（后续 change）。
5. `interrupted` 标志与业务 ephemeral state 清理是迁入方责任，MUST NOT 在本 change 塞进 `Host`。

## Capabilities

- `plugin-runtime-interrupt-v1`
