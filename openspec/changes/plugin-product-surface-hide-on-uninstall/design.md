# Design: plugin-product-surface-hide-on-uninstall

## Context

市场 listing 已能改 `desiredState`。产品命令闸门已按 lockfile 拒绝 `plugin-uninstalled`。产品壳仍 Core-mount：

- Notes：右侧 toolbar / Quick Switcher / shortcut / `WorkspaceNoteCardPanel`
- Project Map：toolbar / Quick Switcher / `ProjectMapPanel`；Project Memory 是地图产品路径
- Claude：不是独立面板，入口是 `EngineSelector` + `useEngineController.availableEngines`

Claude `interrupt_all` 已存在（shutdown 用），卸载路径未接。`window.confirm` 在 WKWebView 会静默返回 false，必须用 `ConfirmDialog`。

## Goals / Non-Goals

**Goals**

- 卸后藏三根插头的入口和面板。
- 卸 Claude 前提示，确认后打断所有 in-flight Claude turn。
- 默认 present，避免首屏闪藏。

**Non-Goals**

- Slim、删 sqlite / history、Host 真 boot。
- 把 presence 放进 AppShell bag。
- 秒级轮询或根链高频 setState。

## Decisions

1. **独立 presence store。** `src/services/pluginPresence.ts` 用 `useSyncExternalStore`。`isPlugged` = `desiredState !== "uninstalled"`。快照里缺插头视为 present，避免闪藏。
2. **发布点。** `getPluginRackSnapshot` / `installPlugin` / `uninstallPlugin` 成功后 `publishPluginRackSnapshot`。市场页在 `setSnapshot` 后再发一次，保证 mock 测试也能更新 presence。
3. **禁止静态环。** `pluginPresence` 只 type-import `pluginRack`；hydrate 用动态 `import("./tauri/pluginRack")`。
4. **离开表面。** `useAppShellLayoutNodesSection` 在卸后把 `centerMode` / `filePanelMode` / `editorSplitCompanion` 从 notes / projectMap / memory 收回 chat / files。open handler 在 absent 时 no-op。
5. **Claude 引擎。** `excludeUninstalledPluginEngines` 从 `availableEngines` 去掉 Claude。`activeEngine === "claude"` 且 `!presence.claude` 时切到下一台已安装引擎；不复用 `useAutoMigrateDisabledActiveEngine`（那条路径会 preserve 当前 thread 的 disabled engine）。
6. **Claude 卸前必提示。** 市场无法看见所有 workspace 的 turn，因此永远弹框。取消 = 不调用卸载。确认 = `uninstall_plugin`。后端先 lockfile，再 `interrupt_all_claude_sessions`。无 `AppState`（浏览器预览）则跳过 interrupt。
7. **Project Memory 跟地图走。** Memory 不是第四根插头。

## Risks / Trade-offs

- 浏览器预览只改内存 `desiredState`，没有真实 process 可杀；对话框仍要出现。
- 卸载 Claude 是全局 interrupt，不是当前 thread only。文案必须写清。
- 首帧默认 present，hydrate 后才藏。这是为了避免未装用户闪一下空壳。

## Migration Plan

无数据迁移。产品 lockfile 语义不变。
