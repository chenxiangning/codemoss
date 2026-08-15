# Proposal: notes-plugin-pilot-host-activate

> OpenSpec change id: `notes-plugin-pilot-host-activate`  
> Wave：4C（第二根插头 · Host 假激活）  
> 依赖：4B Manifest + 1B Host  
> 架构：[`14`](../../../docs/architecture/plugin-platform/14-v1-contract-freeze.md)

## Why

Manifest 已对齐 7 条 command，但还没证明 Host 能按 `notes-main` 激活。4C 用 FakeDriver 激活 fixture 的 required closure，不调用 `note_cards.rs`，不迁表。

## 目标与边界

1. `notes_pilot.rs` 从 `notes-pilot.json` 读 unit entries 并 `Host::activate`。
2. slot=`ready`；generation 可 dispatch。
3. **不**打开 `note_cards` 文件、**不**写 `plugin-runtime/data`、**不**改 Claude。
4. 不进 `lib.rs::run` / command_registry。

## 非目标

- DiskStorage 接 Notes（4D）
- 产品 UI / Tauri command 切流
- disable Claude / 删 Core

## Capabilities

### New Capabilities

- `notes-plugin-host-activate-v1`

## 验收标准

1. `pluginId` / entries 来自 `notes-pilot.json`（`notes-worker` + `notes-ui`）。
2. slot=`ready`。
3. `src-tauri/src/note_cards.rs` 与 `engine/claude*` 无 diff。
4. `openspec validate` 通过。
