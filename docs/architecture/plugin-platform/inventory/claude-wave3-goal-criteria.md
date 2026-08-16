# Claude Wave 3 Goal Criteria（Wave 3AR）

> pluginId：`com.mossx.engine.claude`  
> 状态：**inventory-only**。本刀不改实现、不标产品拔插头完成。

## 目标原文对照

| 条款 | 状态 | 证据 |
|---|---|---|
| 双路径 compatibility adapter | 证据已齐 | `ClaudeCompatAdapter` + `claude_owner()` |
| 默认 off | 证据已齐 | env 默认关；GUI / daemon 走 `EngineManager::new()` |
| disable-not-delete | 证据已齐（fixture） | Host 能 disable fixture，`engine/claude.rs` 仍在 |
| 不 push | 守住 | 本地提交 |
| 不删 `engine/claude*` | 守住 | 源码仍在 |
| 不迁 `note_cards` | 守住 | 未动 |
| 不开 Marketplace | 守住 | 过渡仓不进 boot |

## 不是未完成项

产品 disable / slim / 默认开 flag / Marketplace / Notes 切流 **不在本目标范围内**。不要把它们写成 Wave 3 还没做完。
