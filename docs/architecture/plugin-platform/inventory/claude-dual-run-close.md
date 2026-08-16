# Claude Dual-Run Close Inventory（Wave 3AN）

> pluginId：`com.mossx.engine.claude`  
> 状态：**inventory-only**。本刀不改实现、不 disable 产品 Claude、不删代码。

## 插头协议对照

| 步 | 状态 | 证据 |
|---|---|---|
| 1 Inventory | 已齐 | 3A / 3R / 3AE / 3AJ |
| 2 Contract | 已齐 | 3B fixture + 3AL 身份对齐 |
| 3 Adapter | 已齐 | `ClaudeCompatAdapter` + `claude_owner()` |
| 4 Pilot repo | 过渡仓 | `packages/plugin-engine-claude`，不进 boot |
| 5 Dual-run | 默认 off 调用面已齐 | GUI / daemon / catalog / native |
| 6 Conformance | 部分 | Host / fixture 测，不是产品切流验收 |
| 7 Disable | 仅 fixture | 产品 Claude 仍是唯一 runtime owner |
| 8 Slim | **禁止** | 不得删 `engine/claude*` |
| 9 LKG | **禁止** | 不得发 Marketplace / lockfile pin |

## 含义

dual-run **调用面**已收口，且默认 off。这不是产品拔插头。产品 disable / 删 Claude / 开 Marketplace 仍禁止。
