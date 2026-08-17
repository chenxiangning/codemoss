# Proposal: engine-claude-process-entry-map-bin

> OpenSpec change id: `engine-claude-process-entry-map-bin`  
> Wave：P4.7 批次 3（第一根插头 · 生产 bin 映射）  
> 依赖：`engine-claude-process-entry-supervise`  
> 架构：[`06` §5](../../../docs/architecture/plugin-platform/06-engine-plugin-contract.md) · [`15` §3 step 5 Dual-run](../../../docs/architecture/plugin-platform/15-implementation-wave-plan.md)

## Why

批次 2 证明 Process Entry 能 supervise 一个绝对路径 CLI。生产路径仍由 `ClaudeSession::resolve_cli_binary()` 读 `EngineConfig.bin_path` / settings `claudeBin`，然后自己 `Command::spawn`。两边还没对上。

本刀只建映射：把可审计的 `claudeBin` 转成 `SuperviseTarget`，挂到 Manifest 解析出的 Process Entry driver 上。boot 与产品 spawn 仍走旧路。这是 dual-run 切生产 spawn 之前的最后一段插座接线。

## 目标与边界

1. `map_claude_bin_to_supervise(bin)`：仅接受绝对路径、allowlist、真实文件；空 / 相对 / shell stem / 缺文件 → `None`。
2. `claude_process_driver_for_bin(plugin_root, bin)`：Process Entry 可解析且 bin 合法时 `with_supervise`；否则 `missing_executable()`。
3. **MUST NOT** 改 `boot_driver()`。
4. **MUST NOT** 改 `ClaudeSession::resolve_cli_binary` / `Command::spawn`。
5. **MUST NOT** 默认开 `MOSSX_CLAUDE_COMPAT_FACADE`，MUST NOT Slim，MUST NOT Marketplace。
6. 不得宣称产品 stream / interrupt conformance 完成。

## Capabilities

- `engine-claude-process-entry-map-bin-v1`
