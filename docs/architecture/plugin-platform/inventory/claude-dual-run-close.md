# Claude Dual-Run Close Inventory（P4.7-20 复核）

> pluginId：`com.mossx.engine.claude`  
> 状态：**dual-run 已接线，产品默认仍 Core**。本刀不 Slim、不默认开 flag。

## 插头协议对照

| 步 | 状态 | 证据 |
|---|---|---|
| 1 Inventory | 已齐 | 3A / P4.7-1～19 |
| 2 Contract | 已齐 | Manifest `platforms[PlatformId]` + Process Entry |
| 3 Adapter | 已齐 | `ClaudeCompatAdapter` + `decide_claude_spawn_owner` |
| 4 Pilot repo | 过渡仓 + 制品根 | `packages/plugin-engine-claude` 源码；`OUT_DIR` 制品 |
| 5 Dual-run | **默认 Core** | flag 关 → `cmd.spawn()`；flag 开 → Process Entry |
| 6 Conformance | **部分** | 制品根真实 CLI first-interactive / result 已过；产品默认路径未切 |
| 7 Disable | 仅 fixture | 产品 Claude 仍是默认 runtime owner |
| 8 Slim | **禁止** | 不得删 `engine/claude*` |
| 9 LKG | **禁止** | 不得发 Marketplace / lockfile pin |

## 两旗

| flag | 默认 | 打开后 |
|---|---|---|
| `MOSSX_CLAUDE_COMPAT_FACADE` | off | history / catalog 门面，仍 delegate Core |
| `MOSSX_CLAUDE_PROCESS_ENTRY` | off | `send_message` / resume 走 Process Entry |

## 含义

Process Entry 已是真插头（能监督本机 Claude CLI 读到 `result`）。**产品默认路径仍是 Core `cmd.spawn()`。** 这不是拔插头。产品 disable / Slim / Marketplace 仍禁止。
