# Proposal: plugin-marketplace-local-catalog

> OpenSpec change id: `plugin-marketplace-local-catalog`  
> Wave：用户验收刀（插件市场 UI 演示 3 根真插头）  
> 依赖：`plugin-rack-visual-strip`（D-053 插排 3/9）+ `archive/2026-08-17-project-map-plugin-install-loop`（D-052 三根真实装/卸）  
> 架构：本刀开的是 **本地 curated 市场 UI**，不是远程 Registry。D-049 仍禁 45 假插件 + localStorage。

## Why

用户当前唯一验收标准：

1. 插排 100%
2. 插头做 3 个，可插拔，真实
3. 用插件市场可以演示

插排和三根真实装/卸已经齐。市场页现在只是电源条，脚注文案写「Marketplace 仍关闭」，浏览器里 `installPlugin` 直接抛错。没法演示「进市场 → 装/卸 → 插排状态变」。

D-049 禁的是假市场，不是这三根 allowlisted 插头的商店壳。

## What Changes

- 市场页升级为：标题「插件市场」+ 插排状态条 + 3 张可装/卸 listing + 9 张即将开放（无按钮）。
- 安装/卸载 CTA 从插座挪到市场 listing，总数仍为 3，仍调产品 `install_plugin` / `uninstall_plugin`。
- 非 Tauri 预览：只允许三根 allowlisted id 改内存 `desiredState`，禁止 localStorage，禁止给 later-plugin 装。
- D-055：本地 curated 市场 UI 允许；远程 Registry / 签名 / 12 根可写 / Slim 仍禁。

## 目标与边界

1. 用户打开「市场」MUST 看到商店 listing，而不只是电源条。
2. 三根 allowlisted listing MUST 可装可卸，状态与插排 `desiredState` 同步。
3. 九根 later-plugin MUST 可见且无安装按钮。
4. 桌面端 MUST 走现有 lockfile 命令；浏览器 MUST 只改进程内预览快照。
5. 页面 MUST NOT 出现 `Browse Marketplace`，MUST NOT 写远程市场已开放。

## 非目标

- MUST NOT Slim / 删 Core。
- MUST NOT 开远程 Registry / 签名 / 付费 / 社区发布。
- MUST NOT 给 0/9 later-plugin 装按钮或假卸载。
- MUST NOT 做 Host `enabled=true`。
- MUST NOT 把 P6 整行勾完。

## 技术方案取舍

| 选项 | 做法 | 结论 |
|---|---|---|
| A. 只改脚本文案，仍是电源条 | 用户看不到「市场」 | 拒绝 |
| B. 本地 3 listing + 插排状态 + 真命令 | 能演示，不碰 D-049 红线 | **采用** |
| C. 45 catalog + localStorage | 已回退的假市场 | 拒绝 |

## 验收标准

- 市场页有「插件市场」heading、3 张可操作 listing、9 张即将开放。
- `getAllByRole("button")` 中安装/卸载仍为 3。
- 点卸载 Notes → listing 变「安装」，插排对应插座变空座。
- 浏览器预览不写 localStorage；later-plugin 预览安装抛 `plugin-not-allowlisted`。
- focused vitest 绿。

## Capabilities

### New Capabilities

- `plugin-marketplace-local-catalog-v1`: 本地 curated 市场 UI 合同。

### Modified Capabilities

- `plugin-rack-visual-strip-v1`: 3 个 CTA 从插座挪到市场 listing；插排改为状态条。
