# Proposal: plugin-rack-claude-install-loop

> OpenSpec change id: `plugin-rack-claude-install-loop`  
> Wave：P4.7 批次 32（第二根真实闭环插头：Claude）  
> 依赖：P4.7-31 Notes 模板 `plugin-rack-real-install-loop`（已归档）  
> 架构：`15` §3 不允许跳到 Slim。本刀把 Notes 模板套到 `com.mossx.engine.claude`，D-051 豁口 = Notes + Claude，不是市场。

## Why

Notes 真实装/卸已经是模板。插排上只剩 Claude 一根也在 Disable-not-delete、却仍只读。用户要「用 Notes 当 base 改下一根插头」。下一根只能是 Claude：浏览器 / 画布 / 地图还在 0/9 或 Inventory，假装可装是假卸载。现在做，是因为 lockfile / contribution / `activate_allowlisted` 已验证，可以在不 Slim、不开 Marketplace、不 boot-spawn `claude-cli` 的前提下，给 Claude 开 D-051 豁口。

## What Changes

- allowlist 从 Notes-only 扩成 Notes + `com.mossx.engine.claude`。later-plugin 仍拒绝。
- lockfile 缺省 Claude = `installed`（对齐当前 Process Entry 默认 on）。
- 产品 `install_claude` / `uninstall_claude`：Host 生命周期只用 worker-only request（`claude-worker`），**MUST NOT** 在 boot 路径 spawn `claude-cli`。
- atomic contribution：`claude.engine` + `claude.spawn` 一次注册或一次撤销。
- 产品 spawn 闸门 `claude_commands_allowed()` **MUST** 跑在 `decide_claude_spawn_owner` 之前。卸载后默认路径 MUST NOT 静默回 `cmd.spawn`。显式 `MOSSX_CLAUDE_PROCESS_ENTRY=0` 仍是 recovery。
- 产品 restore 同时恢复 Notes 与 Claude。
- 插排给 Notes + Claude 安装/卸载按钮。其余 10 根只读。Marketplace footnote 仍关。
- **MUST NOT** Slim `engine/claude.rs`，**MUST NOT** 删 Core 源码。

## 目标与边界

1. Claude 安装 MUST 使 Host slot `Ready`（worker isolate 活）、contribution 存活、lockfile `installed`，重启后仍安装。
2. Claude 卸载 MUST 使 Host slot `Uninstalled`、isolate 停、contribution 撤销、lockfile `uninstalled`，重启后仍卸载。
3. 卸载 MUST 保留 Claude session / history / 制品，禁止删用户对话。
4. 卸载后默认路径 MUST NOT 静默走 `CoreCommand` / `cmd.spawn`。显式 `MOSSX_CLAUDE_PROCESS_ENTRY=0` MUST 仍能回 Core spawn。
5. allowlist 仅 Notes + Claude。later-plugin MUST 保持只读。
6. 产品 install/restore MUST NOT 经 boot `missing_executable()` spawn `claude-cli`。
7. **MUST NOT** Slim，**MUST NOT** 开 12 插头 Marketplace，**MUST NOT** 用 localStorage 伪装安装态。

## 非目标

- 不 Slim `engine/claude.rs` / `note_cards.rs`。
- 不把 later-plugin（地图 / 浏览器 / 画布 / 其余 CLI）做成可卸插头。
- 不推进 project-map Wave 5B Manifest。
- 不引入远程 Registry / 签名安装。
- 不把 Host 全局 `enabled=true`。
- 不把 per-turn Process Entry 改成 boot 常驻 CLI。

## 技术方案对比

| 选项 | 做法 | 取舍 |
|---|---|---|
| A. 把 Claude 当 later-plugin 继续只读 | 只改文档 | **拒绝**。两根 Disable 插头里只剩 Claude 可抄模板；再拖就是装忙。 |
| B. 产品 restore 调 `claude_activation_request()`（cli+worker） | 与 fixture 完全一致 | **拒绝**。boot driver 是 `missing_executable()`，catalog 含 `claude-cli`，会在 restore 时假 spawn / Crash。 |
| C. Notes 模板 + worker-only 生命周期 + spawn 闸门先于 decide | allowlist 扩 Claude；Host 只拉 `claude-worker`；真实 CLI 仍走 per-turn Process Entry | **采用**。D-051 豁口最小；`0` 与 Core 源码保留；不把 boot 变成常驻 CLI。 |

## Capabilities

### New Capabilities

- `plugin-rack-claude-install-loop-v1`: Claude 第二根真实安装/卸载、worker-only 生命周期、spawn 闸门先于 decide

### Modified Capabilities

- `plugin-rack-real-install-loop-v1`: allowlist 从 Notes-only 扩成 Notes + Claude；缺省 lockfile Claude = installed；插排两根可写
- `plugin-runtime-uninstall-v1`: Uninstalled Claude slot 也可经 allowlisted install 再进 Ready
- `plugin-pilot-disable-not-delete-v1`: 产品 registry 允许 Notes+Claude allowlist，仍禁止 Marketplace 与 `activate_plugin`

## Impact

- Rust：`plugin_runtime/{install,lockfile,contributions,claude_pilot}.rs`，`plugin_rack.rs`，`engine/claude.rs` spawn / resume
- Frontend：`pluginRack.ts` + test、`PluginRackSection.tsx` + test
- Docs：`09-decision-log.md` D-051、`16-progress-dashboard.md`、卸载依赖链、changes README
- 不 Slim、不删 `engine/claude.rs`、不改 later-plugin

## 验收标准

1. `openspec validate plugin-rack-claude-install-loop --strict` 通过。
2. lockfile 缺省 Claude = installed；卸载写入 `uninstalled`；重启读取仍卸载。
3. `install_plugin("com.mossx.engine.claude")` → slot Ready + contributions live；`uninstall_plugin` → Uninstalled + contributions 空 + spawn 返回 `plugin-uninstalled`。
4. `install_plugin("com.mossx.project-map")` 与 later-plugin MUST 拒绝。Notes 仍可装可卸。
5. 显式 `0` 时 Core spawn 仍可达；`engine/claude.rs` 仍在。
6. 插排仅 Notes + Claude 有安装/卸载按钮；其余 10 根无 button。
7. 产品 lifecycle request MUST 只有 `claude-worker`，MUST NOT 在 install/restore 时 start `claude-cli`。
8. 无 Slim、无 Marketplace catalog、无 localStorage 安装态。
