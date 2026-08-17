# Proposal: project-map-plugin-install-loop

> OpenSpec change id: `project-map-plugin-install-loop`  
> Wave：P4.7 Wave 5G（第三根真实闭环插头：Project Map / D-052）  
> 依赖：`project-map-plugin-disable-not-delete`  
> 架构：`15` §3 不允许跳到 Slim。本刀把 Notes 模板套到 `com.mossx.project-map`，D-052 豁口 = Notes + Claude + Project Map。

## Why

Claude / Notes 真实装/卸已经是模板。插排上地图仍 later-plugin 只读。用户要第三根插头走到同级。现在做，是因为产品默认隔离 + Disable 已齐，可以在不 Slim、不开 Marketplace 的前提下开 D-052 豁口。

## What Changes

- allowlist 扩成 Notes + Claude + `com.mossx.project-map`。later-plugin 仍拒绝（reject 目标改 `com.mossx.browser`）。
- lockfile 缺省 Project Map = `installed`。
- 产品 install/uninstall/restore 三路；Host 生命周期用 fixture 全量 3 entries（无 CLI spawn 风险）。
- atomic contribution：`project-map.main` + `project-map.memory` + 24 条 command。
- 产品闸门 `project_map_commands_allowed()` 跑在 24 条 wrapper 最前。卸载后默认路径 MUST NOT 静默回 `*_core`。
- 插排给第三组安装/卸载按钮。其余 9 根只读。

## 目标与边界

1. 安装 MUST 使 Host slot `Ready`、contribution 存活、lockfile `installed`。
2. 卸载 MUST 使 Host slot `Uninstalled`、contribution 撤销、lockfile `uninstalled`，sqlite 保留。
3. 卸载后默认路径 MUST NOT 静默走 `*_core`。显式 `0` MUST 仍能回 Core。
4. allowlist 仅三根。later-plugin MUST 保持只读。
5. **MUST NOT** Slim，**MUST NOT** 开 Marketplace，**MUST NOT** 做可视化插排。

## Capabilities

- `project-map-plugin-install-loop-v1`
- `plugin-rack-real-install-loop-v1`（MODIFY）
