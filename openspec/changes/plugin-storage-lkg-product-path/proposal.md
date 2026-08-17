# Proposal: plugin-storage-lkg-product-path

> Wave：2AG（插座通电 · 三根插头 LKG 产品路径）

> 依赖：`plugin-storage-lkg-skeleton`（stage/complete 骨架）+ D-052 三根 allowlist 真装真卸

## Why

LKG 骨架只在测试里闭环：`stage_own_update` / `complete_own_update` 不进产品 install/restore，BootHost 每次用唯一 temp 根，pin 活不过重启。三根允许插头（Notes / Claude / Project Map）装上之后没有 per-plugin last-known-good，store 坏了只能重装空库。现在要把骨架接到产品路径，让每根插头有自己的 pin。

## 目标与边界

1. 每个 `pluginId` 在 `{durable_root}/plugin-lock.json` 有独立 pin（`pluginId + version + checkpointId + schemaVersion`）。
2. 产品路径接 3 根：`com.mossx.notes`、`com.mossx.engine.claude`、`com.mossx.project-map`。
3. 首次成功 install 必须 pin；boot restore 必须读同一 durable 根；store 不健康必须 `restore_to` 该 pin。
4. uninstall 保持 Disable-not-delete：pin 与 checkpoint 不得删。
5. Claude health 必须诚实：slot Ready + bookkeeping store，禁止假装 schema-migrate 等于 Claude 会话数据健康。

## 非目标

- 不 Slim、不独立仓、不开远程 Marketplace、不把 Host `enabled` 改成 `true`。
- 不接 P2.6 retention cleanup、不接 P2.7 crash-during-migration。
- 不把产品 `plugin-lockfile.json`（desired-state）与 LKG `plugin-lock.json` 合并。
- 不给 later-plugin 写 pin，不开第 4 根。

## What Changes

- Boot 产品路径改用 durable storage root：`~/.ccgui`（`plugin-lock.json` 与 `plugin-runtime/` 同根）。`boot_host()` 测试仍用 ephemeral temp。
- `PluginRuntime::establish_own_lkg`：无 pin 则 checkpoint + commit；有 pin 则 health 失败 `restore_pinned`。
- 三根 `install_*` 在 slot Ready 后调用 establish；`restore_allowlisted` 因此自动 heal。
- DiskStorage 增加 adopt / restore-from-disk，避免 reboot 后内存 namespace 空导致覆盖 schema 或找不到 checkpoint。

## Capabilities

### New Capabilities

- `plugin-storage-lkg-product-path-v1`：三根 allowlist 插头的产品 LKG pin / restore / uninstall-keep

### Modified Capabilities

- （无）骨架 capability 仍只覆盖 stage/complete 测试闭环

## Impact

- `src-tauri/src/plugin_runtime/{runtime,install,disk_storage,storage,boot,lkg}.rs`
- `src-tauri/src/lib.rs` setup：`boot_host_at(app_home)`
- 文档：`docs/architecture/plugin-platform/{09-decision-log,16-progress-dashboard}.md`
- 验收：focused `cargo test` install/runtime/boot；不得宣称 P2.5 整行完成

## 技术方案取舍

| 选项 | 做法 | 取舍 |
|---|---|---|
| A. 产品路径接 per-plugin pin + durable root | install/restore 调 establish；boot 用 `~/.ccgui` | **采用。** 最小闭环，骨架 API 复用，Claude 不装假 migrate |
| B. 把 stage/complete 当首次安装 | 每次 install 都 migrate candidate | 拒绝。首次安装不是 update；会把空库当 candidate |
| C. 三根共用一个全局 LKG | 单 pin 覆盖全部插头 | 拒绝。一根坏不应拖另外两根 |

## 验收标准

1. 三根各自 pin 写入 `plugin-lock.json`，互不覆盖。
2. 同一 root 新建 `PluginRuntime`（模拟重启）后 pin 仍在；store schema 被改坏后 install/restore 回到 pin schema。
3. uninstall 后 pin 与 sqlite 仍在。
4. 产品 `plugin-lockfile.json` 不被 LKG 写入。
5. Host 仍 `enabled=false`。
