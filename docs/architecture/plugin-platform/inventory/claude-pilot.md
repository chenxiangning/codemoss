# Claude Pilot Inventory（Wave 3A）

> pluginId：`com.mossx.engine.claude`  
> 状态：**inventory-only**。本刀不删代码、不双写、不改产品行为。

## 必须留下的 Core

Engine Contract / registry / `EngineType` union / `manager.rs` 的调度面。Claude 抽出后这里只留 compatibility adapter 槽。

## 目标迁出（稳定后 disable-not-delete）

| 层 | 落点 |
|---|---|
| Adapter + stream | `engine/claude.rs`、`engine/claude/` |
| History | `engine/claude_history*` |
| Slash / home | `claude_commands.rs`、`claude_home.rs` |
| Frontend history / rewind / resume | `src/features/threads/**/claude*`、`claudeResumeCommand.ts` |
| Vendor settings | `ClaudeLocalSettingsCard`、`vendor_*claude*` commands（23 条中的 vendor 段） |
| i18n | `claudeModes.ts` × 10 locale |

## 禁止跟 Claude 一起走

其他 6 个 CLI、Git/Search foundation、AppShell 壳、`command_registry` 生成器本身。

## 拔插头下一步（另开 change）

3B：Claude Manifest + Engine Contribution exact declaration。  
3C：compatibility adapter 双路径（单 active owner）。  
禁止从 3A 跳到删 `engine/claude*`。
