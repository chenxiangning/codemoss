# Proposal: notes-plugin-pilot-manifest

> OpenSpec change id: `notes-plugin-pilot-manifest`  
> Wave：4B（第二根插头 · Contract 草稿）  
> 依赖：`notes-plugin-pilot-inventory`、`plugin-manifest-v1-parser`  
> 架构：[`14` §10](../../../docs/architecture/plugin-platform/14-v1-contract-freeze.md)

## Why

4A 已钉死 7 条 `note_card_*` 与 workspace UI。现有 `notes-minimal.json` 只示范 1 个 view + 1 个 `notes.create`，不能当 inventory 合同。4B 另写 `notes-pilot.json`，exact 声明全部 command，不接 Host、不迁表、不 disable Claude。

## 目标与边界

1. 落下 `packages/plugin-contract/fixtures/valid/notes-pilot.json`。
2. 保留 `notes-minimal.json` 作为 Wave 0B 最小合同，不被本刀撑胖。
3. contributions：exact `mossx.ui.view` + 7 条 exact `mossx.command`（commandId 对齐 inventory）。
4. 激活用 `onView` / `onCommand`；**禁止** `onStartup`。
5. trusted-react 仅 system Notes UI 允许；无 `mossx.engine.provider`。
6. `parseManifestV1` 在 `trustTier=system` 下成功。
7. `src-tauri/src/note_cards.rs` 与 `engine/claude*` 零行为 diff。

## 非目标

- Host 假激活（4C）
- 迁 `note_cards` 到 DiskStorage
- 改产品 command_registry
- Claude disable

## Capabilities

### New Capabilities

- `notes-plugin-manifest-v1`：Notes Pilot exact view + 7 commands

## 验收标准

1. `pluginId` 为 `com.mossx.notes`。
2. 7 个 inventory commandId 均 exact 出现。
3. 无 `onStartup`、无 engine.provider。
4. parser 接受；template 化 `mossx.command` 被拒绝。
5. 本 change 不修改 Notes / Claude 生产实现。
6. `openspec validate` 通过。
