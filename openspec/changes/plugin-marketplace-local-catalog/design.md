# Design: plugin-marketplace-local-catalog

## Context

市场页挂在 `appMode === "market"`，渲染 `PluginRackSection`。插排 3/9 已落地。装/卸命令已存在。缺商店壳和浏览器可点预览。

## Goals / Non-Goals

**Goals**

- 市场页能演示三根真插头的装/卸。
- 插排继续证明 3 座可插 / 9 座封口。
- 浏览器可点，且诚实标注「预览」。

**Non-Goals**

- 远程 index、签名、付费、自动更新。
- Slim / Host 真 boot。
- 第四根插头。

## Decisions

1. **CTA 只在 listing 上。** 插排插座改为纯状态，保证全页安装/卸载 button 仍为 3。
2. **同一快照。** listing 与插座都读 `PluginRackSnapshot.desiredState`，不另开商店状态。
3. **浏览器预览是进程内存。** `!isTauri()` 时 `installPlugin` / `uninstallPlugin` 只改模块内 snapshot。禁止 localStorage。非 allowlisted id 抛 `plugin-not-allowlisted`。
4. **远程市场仍关。** 文案写「本地 curated / 远程关闭」。禁止 `Browse Marketplace`。

## Risks / Trade-offs

- 浏览器预览不会让笔记面板真的消失。桌面端才会写 lockfile 并停用插头。页面必须写明。
- 把「市场」打开会被误读成 P6 完成。P6 只记「本地 UI 骨架」，不勾 Registry / 签名。

## Migration Plan

无数据迁移。产品 lockfile 语义不变。
