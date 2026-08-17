# Design

## Context

Notes 闭环（D-050）已归档：disk lockfile、atomic contribution、`activate_allowlisted`、产品 `install_plugin` / `uninstall_plugin`、插排单按钮、`note_card_*` 闸门。allowlist 仍 Notes-only。

Claude 现状：

- Disable-not-delete：Core owner 默认 disabled，`MOSSX_CLAUDE_PROCESS_ENTRY` 未设即 on，`0` 回 `cmd.spawn`。
- 产品 spawn 走 `decide_claude_spawn_owner`：`(false, _) => CoreCommand`，`(true, Some) => ProcessEntry`，`(true, None) => Denied`。
- fixture `claude_activation_request()` 要 `claude-cli` + `claude-worker`。boot `RestrictedProcessDriver` 用 `missing_executable()`，catalog 含 `claude-cli`。产品 restore 若照抄 fixture，会在启动时假 spawn。
- 插排 DECLARED 快照：Claude `installable: false` / `desiredState: "uninstalled"`。这与产品默认 Process Entry on 不一致。

## Goals / Non-Goals

**Goals:**

- 把 Notes 模板套到 Claude：真实装/卸，状态过重启。
- 卸载后默认路径 fail closed，不静默回 Core。
- Host 生命周期诚实：worker isolate 证明 slot Ready/Uninstalled；真实 CLI 仍 per-turn。

**Non-Goals:**

- Slim、Marketplace、later-plugin、project-map 5B、Host 全局启用。
- 把 `claude-cli` 变成 boot 常驻进程。

## Decisions

### D1. 第二根闭环插头 = Claude，不是地图 / 浏览器 / 画布

地图还在 Inventory；浏览器 / 画布 0/9。只有 Claude 与 Notes 同在 Disable-not-delete。第一刀已是 Notes，本刀是允许的第二刀。

### D2. D-051 豁口 = Notes + Claude，不是市场

D-050 写死「一根」。本刀用新决策 D-051 把它扩成两根系统插头。later-plugin 仍只读。D-049 仍禁假市场 / localStorage / 12 插头可写。

### D3. 产品 Claude 生命周期 = worker-only

新增 `claude_lifecycle_activation_request()`：`unit_id = claude-engine`，`required_entries = ["claude-worker"]`。`RestrictedProcessDriver` 对 `claude-worker` 是 catalog no-op；`QuickJsWorkerDriver` 拉 isolate。fixture `claude_activation_request()` 保持 `cli+worker`，只给测试 / FakeDriver。

备选：restore 时 start `claude-cli`。拒绝，boot executable 是 missing。

### D4. 缺省 lockfile Claude = installed

用户已经在 Process Entry 默认 on。缺文件视为 installed，避免升级后「突然卸了 Claude」。卸载后写 `uninstalled`，重启仍卸。

### D5. spawn 闸门先于 decide

`claude_commands_allowed()`：process-entry 关（显式 `0`）则放行 recovery；否则 lockfile `uninstalled` 返回 `plugin-uninstalled`。调用点：`engine/claude.rs` 主 spawn **以及** `try_resume_process_entry_turn`，且 MUST 在 `decide_claude_spawn_owner` 之前。禁止 `uninstalled + facade-on => CoreCommand`。

### D6. contribution = `claude.engine` + `claude.spawn`

对齐 Manifest `contributions[0].id = claude.engine`。产品闸门命令 id 用 `claude.spawn`（spawn / resume 入口）。一次 register / 一次 revoke。

### D7. 卸载不删 session / history / 制品

对称 Notes 不删 sqlite。Core 源码与 `0` 回退保留。

## Risks / Trade-offs

- [Risk] 用户以为卸 Claude 会删对话 → Mitigation：卸载不删 history；文案沿用「停用插头，保留数据」。
- [Risk] 被读成 Marketplace 已开 → Mitigation：D-051 写死 10 根 later-plugin 只读；footnote 仍关。
- [Risk] worker isolate Ready 被读成「CLI 已常驻」→ Mitigation：design / dashboard 写明 lifecycle ≠ per-turn spawn。
- [Trade-off] Claude CRUD / stream 仍在 Core 进程的 Process Entry。Host isolate 证明生命周期真实，执行面仍是 Dual-run 后的产品路径。诚实，不装抽出。

## Migration Plan

1. 默认无 lockfile：Claude 仍可用（installed）。
2. 用户点卸载：写 lockfile，restore 后不再激活 isolate，spawn fail closed。
3. 回滚：装回 Claude，或显式 `MOSSX_CLAUDE_PROCESS_ENTRY=0`；源码仍在。

## Open Questions

无。第二插头与 worker-only 生命周期已在 Notes 收口轮拍板。
