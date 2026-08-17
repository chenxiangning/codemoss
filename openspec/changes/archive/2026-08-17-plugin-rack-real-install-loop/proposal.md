# Proposal: plugin-rack-real-install-loop

> OpenSpec change id: `plugin-rack-real-install-loop`  
> Wave：P4.7 批次 31（插排可写 + 第一根真实闭环插头）  
> 依赖：P4.7-29 disable-not-delete、P4.7-30 project-map inventory-only  
> 架构：`15` §3 不允许跳到 Slim。本刀只把「真实安装/卸载」接到产品路径，且 **allowlist = Notes only**。

## Why

插排现在只读，Host `uninstall` 只在测试里转。用户要的是一根能拔能插的真插头：安装后 Host Ready、contribution 在、重启仍在；卸载后 Host Uninstalled、进程/isolate 停、命令/视图消失、不偷偷回 Core、数据 checkpoint 留下、重启仍卸着。现在做，是因为 disable-not-delete 已钉死 Core 源码与 `0` 回退，可以在不 Slim、不开 Marketplace 的前提下，给 Notes 开 D-050 豁口。

## What Changes

- 新增持久 lockfile：`installed | uninstalled`，重启可恢复。缺省 Notes = `installed`（对齐当前隔离 sqlite 产品态）。
- 新增 atomic contribution registry：Notes 的 `notes.main` + 7 个 `note_card_*` 一次注册或一次撤销。
- 产品命令 `install_plugin` / `uninstall_plugin` 仅允许 `com.mossx.notes`。其它 11 根插头拒绝。
- Host 增加 `prepare_install` + `activate_allowlisted`：从 `Uninstalled` 再装；一般 `activate` 仍 `host-disabled`。
- 产品 boot 按 lockfile 恢复 Notes；其它插头仍 `missing_executable()` + idle。
- 插排 UI 只给 Notes 安装/卸载按钮。Marketplace / 12 插头目录仍关。
- Notes 卸载后 `note_card_*` 返回 `plugin-uninstalled`，**MUST NOT** 静默走 `note_card_*_core`。显式 `0` 仍是 recovery，不是卸载。
- **MUST NOT** Slim `note_cards.rs`，**MUST NOT** 删 Core 源码。

## 目标与边界

1. Notes 安装 MUST 使 Host slot `Ready`、contribution 存活、lockfile `installed`，重启后仍安装。
2. Notes 卸载 MUST 使 Host slot `Uninstalled`、isolate/进程停、contribution 撤销、lockfile `uninstalled`，重启后仍卸载。
3. 卸载 MUST 保留 Notes sqlite checkpoint / 数据文件，禁止删用户笔记。
4. 卸载后默认路径 MUST NOT 静默回 Core。显式 `MOSSX_NOTES_COMPAT_FACADE=0` MUST 仍能回 `note_card_*_core`。
5. 仅 `com.mossx.notes` 可安装/卸载。Claude 与 later-plugin MUST 保持只读。
6. **MUST NOT** Slim，**MUST NOT** 开 12 插头 Marketplace，**MUST NOT** 用 localStorage 伪装安装态。

## 非目标

- 不 Slim `note_cards` / `engine/claude.rs`。
- 不把 Claude 做成第一根可卸插头（默认 CLI 爆炸半径过大）。
- 不做 hello demo 插头当模板。
- 不推进 project-map Wave 5B Manifest。
- 不引入远程 Registry / 签名安装。
- 不把 Host 全局 `enabled=true`（其它插头仍 default-off）。

## 技术方案对比

| 选项 | 做法 | 取舍 |
|---|---|---|
| A. 假市场按钮 + localStorage | 插排写标记，不碰 Host | **拒绝**。D-049 已回退。不是真实卸载。 |
| B. 12 插头全部可装可卸 | 插排对 DECLARED_PLUGS 全开按钮 | **拒绝**。later-plugin 仍是 Core；会伪装成 Marketplace。 |
| C. Notes allowlist + lockfile + Host allowlisted activate + contribution registry | 只对 `com.mossx.notes` 走真实 Host Ready/Uninstalled，产品命令与插排按钮同步 | **采用**。D-050 豁口最小；`0` 与 Core 源码保留；可作为后续插头模板。 |

## Capabilities

### New Capabilities

- `plugin-rack-real-install-loop-v1`: Notes-only 真实安装/卸载、lockfile、contribution registry、插排可写按钮

### Modified Capabilities

- `plugin-runtime-uninstall-v1`: `Uninstalled` 可通过 allowlisted install 再进入 `Ready`（本刀就是当初写的「后续 change」）
- `plugin-pilot-disable-not-delete-v1`: 产品 registry 允许 `install_plugin` / `uninstall_plugin`（Notes allowlist），仍禁止 Marketplace 与 `activate_plugin`

## Impact

- Rust：`plugin_runtime/{host,runtime,boot,mod}.rs`，新增 `lockfile.rs` / `contributions.rs` / `install.rs`，`plugin_rack.rs`，`command_registry.rs`，`note_cards.rs`，`lib.rs` setup
- Frontend：`PluginRackSection.tsx` + test、`pluginRack.ts`、i18n `sidebar.ts`、extensions CSS
- Docs：`09-decision-log.md` D-050、`16-progress-dashboard.md`、`real-uninstall-dependency-chain.md`、`openspec/changes/README.md`
- 不改 Claude 产品 spawn，不删 `note_cards` / `engine/claude.rs`

## 验收标准

1. `openspec validate plugin-rack-real-install-loop --strict` 通过。
2. lockfile 缺省 Notes = installed；卸载写入 `uninstalled`；重启读取仍卸载。
3. `install_plugin("com.mossx.notes")` → slot Ready + contributions live；`uninstall_plugin` → Uninstalled + contributions 空 + `note_card_list` 返回 `plugin-uninstalled`。
4. `install_plugin("com.mossx.engine.claude")` 与 later-plugin MUST 拒绝。
5. 显式 `0` 时 `note_card_*_core` 仍可达；Core 源文件仍在。
6. 插排仅 Notes 有安装/卸载按钮；其余 11 根无 button。
7. 无 Slim、无 Marketplace catalog、无 localStorage 安装态。
