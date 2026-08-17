# Claude Dual-Run Close Inventory（P4.7-24 复核）

> pluginId：`com.mossx.engine.claude`  
> 状态：**产品默认走 Process Entry**。显式 `MOSSX_CLAUDE_PROCESS_ENTRY=0` 才回 Core。不 Slim。

## 插头协议对照

| 步 | 状态 | 证据 |
|---|---|---|
| 1 Inventory | 已齐 | 3A / P4.7-1～24 |
| 2 Contract | 已齐 | Manifest `platforms[PlatformId]` + Process Entry |
| 3 Adapter | 已齐 | `decide_claude_spawn_owner` |
| 4 Pilot repo | 过渡仓 + 制品根 | `packages/plugin-engine-claude`；`OUT_DIR` 制品 |
| 5 Dual-run | **默认 Process Entry** | 未设 / 1 → PE；`0` → `cmd.spawn()` |
| 6 Conformance | **部分** | 制品根真实 CLI first-interactive / result 已过；产品路径已切 PE |
| 7 Disable | 仅 fixture | Core spawn 仍作显式回退 |
| 8 Slim | **禁止** | 不得删 `engine/claude*` |
| 9 LKG | **禁止** | 不得发 Marketplace |

## 含义

用户日常 `send_message` 默认监督 Process Entry。缺 plan fail closed。`boot_driver()` 仍 `missing_executable()`。这不是 Slim。
