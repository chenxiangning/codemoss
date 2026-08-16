# Proposal: engine-claude-compat-lifecycle

> OpenSpec change id: `engine-claude-compat-lifecycle`  
> Wave：3H（第一根插头 · 门面补 remove / interrupt）  
> 依赖：`engine-claude-dual-run-flag`  
> 架构：[`06`](../../../docs/architecture/plugin-platform/06-engine-plugin-contract.md)、[`14` §17](../../../docs/architecture/plugin-platform/14-v1-contract-freeze.md)

## Why

3E 只让 flag on 时 `get_claude_session*` 经门面。`remove_claude_session` 仍直打 `claude_manager`。unload 是 load 的逆操作；生命周期一半走门面、一半绕过，双路径无法单独回滚。

## 目标与边界

1. `ClaudeCompatAdapter` MUST 委托 `remove_workspace_sessions` / `interrupt_workspace_sessions` 到同一份 Core manager。
2. flag on：`EngineManager::remove_claude_session` MUST 经门面。
3. flag on：新增 `EngineManager::interrupt_claude_sessions` MUST 经门面。
4. flag off：行为与 3E 相同，不构造门面。
5. MUST NOT 第二个 live owner、不删 `engine/claude*`、不搬 history、不默认开 flag、不接 Host boot。

## 非目标

- 改 `engine_interrupt` / daemon 现有直调（下一刀）
- 独立插件进程 / `.mossx-plugin`
- Notes / Marketplace

## Capabilities

- `engine-claude-compat-lifecycle-v1`

## 验收标准

1. flag off 时不经门面 remove。
2. flag on 时经门面 remove 后，Core manager 不再持有该 workspace session。
3. flag on 时 interrupt 经门面，仍是同一份 manager。
4. `openspec validate` 通过。
