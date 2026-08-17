# Proposal: plugin-product-surface-hide-on-uninstall

> OpenSpec change id: `plugin-product-surface-hide-on-uninstall`  
> Wave：用户验收刀（卸后藏壳 + Claude 卸前打断提示）  
> 依赖：`plugin-marketplace-local-catalog`（市场 listing 真装真卸）+ `archive/2026-08-17-plugin-rack-claude-install-loop`（Claude 产品闸门）  
> 架构：本刀只让产品 UI 跟随 allowlisted `desiredState`，并在卸载 Claude 时确认后打断 in-flight turn。不 Slim，不开远程 Registry，不改 Host default-off。

## Why

三根真插头的产品命令已经被 lockfile 切断，但 AppShell 仍 Core-mount 笔记 / 知识地图 / Claude 入口。用户看到「功能禁用了，UI 还在」。卸载 Claude 也不会打断正在跑的 turn。

用户选定的两项：

1. 卸载后藏笔记 / 地图 / Claude 入口和面板
2. 卸载 Claude 时打断正在跑的 turn，且必须有提示

## What Changes

- 产品 UI 读 allowlisted `desiredState`：`uninstalled` 后隐藏 Notes / Project Map（含 Project Memory）/ Claude 入口与对应面板。
- 市场卸载 Claude 前 MUST 弹出 `ConfirmDialog`；取消不卸载；确认后先写 lockfile，再 `interrupt_all`。
- Notes / Project Map 卸载保持立即执行，不加确认框。
- Chat canvas 保留（多引擎）。不删数据，不 Slim。

## 目标与边界

1. Notes `desiredState === uninstalled` 后，右侧工具栏、Quick Switcher、快捷键与笔记面板 MUST 不可达。
2. Project Map 卸载后，地图入口/面板与 Project Memory 入口/面板 MUST 一起消失。
3. Claude 卸载后，EngineSelector MUST 不再列出 Claude；若当前引擎是 Claude，MUST 切到下一台已安装引擎。
4. 卸载 Claude MUST 先提示再执行；确认文案 MUST 说明会打断所有进行中的 Claude turn。
5. 取消确认 MUST 保持 Claude 已安装，MUST NOT 调用 `uninstall_plugin`。

## 非目标

- MUST NOT Slim / 删 Core / 删磁盘数据。
- MUST NOT 开远程 Registry / Host `enabled=true`。
- MUST NOT 把 presence 塞进 AppShell domain bag。
- MUST NOT 对 Notes / Project Map 卸载加确认框。
- MUST NOT 隐藏整个 Chat canvas。

## 技术方案取舍

| 选项 | 做法 | 结论 |
|---|---|---|
| A. 只关命令，UI 仍挂着 | 用户看到死入口 | 拒绝 |
| B. presence store + 入口/面板跟随 `desiredState`；Claude 卸前 ConfirmDialog + 后端 interrupt | 验收两项一次落地 | **采用** |
| C. 复用 `useAutoMigrateDisabledActiveEngine` 且 preserve 当前 thread | 卸后 Claude 入口可能留下 | 拒绝 |

## 验收标准

- 卸载 Notes：笔记入口与面板消失；装回后恢复。
- 卸载 Project Map：地图与 Project Memory 入口/面板一起消失。
- 卸载 Claude：先出确认框；取消则仍安装；确认后入口消失且 in-flight turn 被打断。
- Notes 卸载仍立即执行，无确认框。
- focused vitest + plugin_rack source-contains 绿。

## Capabilities

### New Capabilities

- `plugin-product-surface-hide-on-uninstall-v1`: 产品壳跟随 allowlisted `desiredState`；Claude 卸前确认并打断。
